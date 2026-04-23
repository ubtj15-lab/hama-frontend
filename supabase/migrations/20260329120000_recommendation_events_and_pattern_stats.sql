-- HAMA 추천 엔진: raw 행동 + 패턴 집계 + learned_boost
-- buildPatternKey(앱)과 동일: scenario|child|weather|tod|band|templateId|stepPattern

-- ---------------------------------------------------------------------------
-- Raw events (앱: logRecommendationEvent → /api/recommendation/log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id TEXT NOT NULL,
  user_id TEXT,
  event_name TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  scenario TEXT,
  child_age_group TEXT,
  weather_condition TEXT,
  time_of_day TEXT,
  date_time_band TEXT,
  rank_position INT,
  source_page TEXT,
  template_id TEXT,
  step_pattern TEXT,
  place_ids TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT recommendation_events_event_name_check CHECK (
    event_name IN (
      'place_impression',
      'place_click',
      'course_impression',
      'course_click',
      'course_start',
      'reservation_create',
      'reservation_complete',
      'course_restore_success',
      'course_restore_fail'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_created_at ON recommendation_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_session_id ON recommendation_events(session_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_id ON recommendation_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recommendation_events_scenario ON recommendation_events(scenario) WHERE scenario IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recommendation_events_event_name ON recommendation_events(event_name);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_entity ON recommendation_events(entity_type, entity_id);

ALTER TABLE recommendation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recommendation_events_anon_insert" ON recommendation_events FOR INSERT WITH CHECK (true);
CREATE POLICY "recommendation_events_anon_select" ON recommendation_events FOR SELECT USING (true);

COMMENT ON TABLE recommendation_events IS '추천/코스/예약 통합 raw 로그 (learned boost 집계 소스)';

-- ---------------------------------------------------------------------------
-- Pattern stats (batch: refresh_recommendation_pattern_stats)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendation_pattern_stats (
  pattern_key TEXT PRIMARY KEY,
  scenario TEXT,
  child_age_group TEXT,
  weather_condition TEXT,
  time_of_day TEXT,
  date_time_band TEXT,
  template_id TEXT NOT NULL DEFAULT '*',
  step_pattern TEXT NOT NULL DEFAULT '',
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  starts BIGINT NOT NULL DEFAULT 0,
  reservations BIGINT NOT NULL DEFAULT 0,
  completes BIGINT NOT NULL DEFAULT 0,
  restore_fails BIGINT NOT NULL DEFAULT 0,
  ctr DOUBLE PRECISION,
  start_rate DOUBLE PRECISION,
  reservation_rate DOUBLE PRECISION,
  completion_rate DOUBLE PRECISION,
  learned_boost DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_computed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_pattern_stats_scenario ON recommendation_pattern_stats(scenario);
CREATE INDEX IF NOT EXISTS idx_recommendation_pattern_stats_template ON recommendation_pattern_stats(template_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_pattern_stats_impressions ON recommendation_pattern_stats(impressions DESC);

ALTER TABLE recommendation_pattern_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recommendation_pattern_stats_anon_select" ON recommendation_pattern_stats FOR SELECT USING (true);
-- 서비스 롤/Edge에서 upsert; anon 직접 쓰기는 비권장

COMMENT ON TABLE recommendation_pattern_stats IS '패턴별 집계; learned_boost 는 impressions<20 이면 0';
COMMENT ON COLUMN recommendation_pattern_stats.learned_boost IS
  '가중 점수: click*1 + start*5 + reservation*4 + complete*6 - restore_fail*3 를 impressions 기준으로 정규화 후 0~12, imp<20 이면 0';

-- ---------------------------------------------------------------------------
-- Rollup: 일자별·패턴별 raw 카운트 (디버그·BI)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW recommendation_pattern_rollup AS
SELECT
  date_trunc('day', e.created_at AT TIME ZONE 'UTC')::date AS stat_date,
  concat_ws(
    '|',
    coalesce(e.scenario, '-'),
    coalesce(e.child_age_group, '-'),
    coalesce(e.weather_condition, '-'),
    coalesce(e.time_of_day, '-'),
    coalesce(e.date_time_band, '-'),
    coalesce(e.template_id, '*'),
    coalesce(e.step_pattern, '')
  ) AS pattern_key,
  e.scenario,
  e.template_id,
  e.step_pattern,
  count(*) FILTER (WHERE e.event_name = 'place_impression') AS place_impressions,
  count(*) FILTER (WHERE e.event_name = 'place_click') AS place_clicks,
  count(*) FILTER (WHERE e.event_name = 'course_impression') AS course_impressions,
  count(*) FILTER (WHERE e.event_name = 'course_click') AS course_clicks,
  count(*) FILTER (WHERE e.event_name = 'course_start') AS course_starts,
  count(*) FILTER (WHERE e.event_name = 'reservation_create') AS reservations,
  count(*) FILTER (WHERE e.event_name = 'reservation_complete') AS completes,
  count(*) FILTER (WHERE e.event_name = 'course_restore_fail') AS restore_fails,
  count(*)::bigint AS event_rows
FROM recommendation_events e
GROUP BY
  1, 2, 3, 4, 5;

-- ---------------------------------------------------------------------------
-- 집계 갱신: 최근 60일 → recommendation_pattern_stats upsert
-- 가중: click+1, start+5, reservation+4, complete+6, restore_fail-3
-- impressions = place_impression + course_impression (코스/장소 노출)
-- learned_boost: impressions < 20 → 0, else min(12, max(0, raw / impressions * 2.4))
--    raw = clicks*1 + starts*5 + reservations*4 + completes*6 - restore_fails*3
--    (대안: 가중 합 / impressions * 스케일)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_recommendation_pattern_stats()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  min_impressions_for_boost INT := 20;
  max_boost DOUBLE PRECISION := 12.0;
BEGIN
  WITH base AS (
    SELECT
      concat_ws(
        '|',
        coalesce(e.scenario, '-'),
        coalesce(e.child_age_group, '-'),
        coalesce(e.weather_condition, '-'),
        coalesce(e.time_of_day, '-'),
        coalesce(e.date_time_band, '-'),
        coalesce(e.template_id, '*'),
        coalesce(e.step_pattern, '')
      ) AS pattern_key,
      min(e.scenario) AS scenario,
      min(e.child_age_group) AS child_age_group,
      min(e.weather_condition) AS weather_condition,
      min(e.time_of_day) AS time_of_day,
      min(e.date_time_band) AS date_time_band,
      coalesce(min(e.template_id), '*') AS template_id,
      coalesce(min(e.step_pattern), '') AS step_pattern,
      count(*) FILTER (WHERE e.event_name IN ('place_impression', 'course_impression'))::bigint AS impressions,
      count(*) FILTER (WHERE e.event_name = 'place_click')::bigint
        + count(*) FILTER (WHERE e.event_name = 'course_click')::bigint AS clicks,
      count(*) FILTER (WHERE e.event_name = 'course_start')::bigint AS starts,
      count(*) FILTER (WHERE e.event_name = 'reservation_create')::bigint AS reservations,
      count(*) FILTER (WHERE e.event_name = 'reservation_complete')::bigint AS completes,
      count(*) FILTER (WHERE e.event_name = 'course_restore_fail')::bigint AS restore_fails
    FROM recommendation_events e
    WHERE e.created_at > now() - interval '60 days'
    GROUP BY 1
  ),
  calc AS (
    SELECT
      b.*,
      CASE WHEN b.impressions > 0 THEN b.clicks::double precision / b.impressions ELSE NULL END AS ctr,
      CASE WHEN b.impressions > 0 THEN b.starts::double precision / b.impressions ELSE NULL END AS start_rate,
      CASE WHEN b.impressions > 0 THEN b.reservations::double precision / b.impressions ELSE NULL END AS reservation_rate,
      CASE WHEN b.impressions > 0 THEN b.completes::double precision / b.impressions ELSE NULL END AS completion_rate,
      (
        b.clicks * 1.0
        + b.starts * 5.0
        + b.reservations * 4.0
        + b.completes * 6.0
        - b.restore_fails * 3.0
      ) AS raw_weighted
    FROM base b
  )
  INSERT INTO recommendation_pattern_stats (
    pattern_key,
    scenario,
    child_age_group,
    weather_condition,
    time_of_day,
    date_time_band,
    template_id,
    step_pattern,
    impressions,
    clicks,
    starts,
    reservations,
    completes,
    restore_fails,
    ctr,
    start_rate,
    reservation_rate,
    completion_rate,
    learned_boost,
    last_computed_at,
    updated_at
  )
  SELECT
    c.pattern_key,
    c.scenario,
    c.child_age_group,
    c.weather_condition,
    c.time_of_day,
    c.date_time_band,
    c.template_id,
    c.step_pattern,
    c.impressions,
    c.clicks,
    c.starts,
    c.reservations,
    c.completes,
    c.restore_fails,
    c.ctr,
    c.start_rate,
    c.reservation_rate,
    c.completion_rate,
    CASE
      WHEN c.impressions < min_impressions_for_boost THEN 0.0
      ELSE least(
        max_boost,
        greatest(0.0, (c.raw_weighted / greatest(c.impressions, 1)::double precision) * 2.4)
      )
    END,
    now(),
    now()
  FROM calc c
  ON CONFLICT (pattern_key) DO UPDATE SET
    scenario = EXCLUDED.scenario,
    child_age_group = EXCLUDED.child_age_group,
    weather_condition = EXCLUDED.weather_condition,
    time_of_day = EXCLUDED.time_of_day,
    date_time_band = EXCLUDED.date_time_band,
    template_id = EXCLUDED.template_id,
    step_pattern = EXCLUDED.step_pattern,
    impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks,
    starts = EXCLUDED.starts,
    reservations = EXCLUDED.reservations,
    completes = EXCLUDED.completes,
    restore_fails = EXCLUDED.restore_fails,
    ctr = EXCLUDED.ctr,
    start_rate = EXCLUDED.start_rate,
    reservation_rate = EXCLUDED.reservation_rate,
    completion_rate = EXCLUDED.completion_rate,
    learned_boost = EXCLUDED.learned_boost,
    last_computed_at = EXCLUDED.last_computed_at,
    updated_at = EXCLUDED.updated_at;
END;
$$;

COMMENT ON FUNCTION refresh_recommendation_pattern_stats() IS
  'recommendation_events → recommendation_pattern_stats; 주기/Edge에서 호출';
