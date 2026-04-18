-- HAMA 코스 추천 학습: raw 이벤트 + 패턴/장소 집계
-- learned_boost 는 rule 기반 점수를 덮지 않고 가산 보정만 (앱에서 상한 clamp 권장)
-- impressions < 20 인 패턴은 learned_boost = 0 또는 약하게 — 배치에서 반영

-- ---------------------------------------------------------------------------
-- 표준 이벤트명 (CHECK 제약 + 앱 courseLearningTypes 와 동기화)
-- course_events: course_impression, course_card_click, course_detail_view,
--   course_start_click, course_save, course_restore_success, course_restore_fail,
--   course_immediate_exit
-- place_events: place_detail_click, place_route_click, place_call_click, place_save_click
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS course_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id TEXT NOT NULL,
  user_id TEXT,
  event_name TEXT NOT NULL CHECK (
    event_name IN (
      'course_impression',
      'course_card_click',
      'course_detail_view',
      'course_start_click',
      'course_save',
      'course_restore_success',
      'course_restore_fail',
      'course_immediate_exit'
    )
  ),
  course_id TEXT,
  template_id TEXT,
  scenario TEXT,
  child_age_group TEXT,
  weather_condition TEXT,
  time_of_day TEXT,
  date_time_band TEXT,
  rank_position INT,
  source_page TEXT,
  step_pattern TEXT,
  step_categories TEXT[] DEFAULT '{}',
  place_ids TEXT[] DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_course_events_created_at ON course_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_events_session_id ON course_events(session_id);
CREATE INDEX IF NOT EXISTS idx_course_events_user_id ON course_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_course_events_course_id ON course_events(course_id) WHERE course_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_course_events_template_id ON course_events(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_course_events_event_name ON course_events(event_name);
CREATE INDEX IF NOT EXISTS idx_course_events_scenario ON course_events(scenario) WHERE scenario IS NOT NULL;

CREATE TABLE IF NOT EXISTS place_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id TEXT NOT NULL,
  user_id TEXT,
  event_name TEXT NOT NULL CHECK (
    event_name IN (
      'place_detail_click',
      'place_route_click',
      'place_call_click',
      'place_save_click'
    )
  ),
  place_id TEXT NOT NULL,
  course_id TEXT,
  template_id TEXT,
  scenario TEXT,
  step_index INT,
  source_page TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_place_events_created_at ON place_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_place_events_place_id ON place_events(place_id);
CREATE INDEX IF NOT EXISTS idx_place_events_session_id ON place_events(session_id);
CREATE INDEX IF NOT EXISTS idx_place_events_course_id ON place_events(course_id) WHERE course_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 집계 테이블: pattern_key = 앱 buildPatternKey 와 동일 문자열 규칙 권장
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS course_pattern_stats (
  pattern_key TEXT PRIMARY KEY,
  scenario TEXT,
  child_age_group TEXT,
  weather_condition TEXT,
  time_of_day TEXT,
  date_time_band TEXT,
  template_id TEXT NOT NULL DEFAULT '*',
  step_pattern TEXT NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  detail_views BIGINT NOT NULL DEFAULT 0,
  starts BIGINT NOT NULL DEFAULT 0,
  saves BIGINT NOT NULL DEFAULT 0,
  route_clicks BIGINT NOT NULL DEFAULT 0,
  exits BIGINT NOT NULL DEFAULT 0,
  ctr DOUBLE PRECISION,
  start_rate DOUBLE PRECISION,
  save_rate DOUBLE PRECISION,
  learned_boost DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_computed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_pattern_stats_scenario ON course_pattern_stats(scenario);
CREATE INDEX IF NOT EXISTS idx_course_pattern_stats_template ON course_pattern_stats(template_id);
CREATE INDEX IF NOT EXISTS idx_course_pattern_stats_impressions ON course_pattern_stats(impressions DESC);

CREATE TABLE IF NOT EXISTS place_stats (
  place_id TEXT PRIMARY KEY,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  detail_views BIGINT NOT NULL DEFAULT 0,
  route_clicks BIGINT NOT NULL DEFAULT 0,
  saves BIGINT NOT NULL DEFAULT 0,
  ctr DOUBLE PRECISION,
  route_rate DOUBLE PRECISION,
  save_rate DOUBLE PRECISION,
  learned_boost DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_computed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_stats_impressions ON place_stats(impressions DESC);

COMMENT ON TABLE course_events IS '코스 단위 raw 행동 로그 (클라이언트/서버 INSERT)';
COMMENT ON TABLE place_events IS '코스 내 장소 단위 raw 행동 로그';
COMMENT ON TABLE course_pattern_stats IS '패턴별 집계 + 추천용 learned_boost (rule 점수에 가산)';
COMMENT ON TABLE place_stats IS '장소별 집계 + learned_boost (rule 점수에 가산)';
COMMENT ON COLUMN course_pattern_stats.learned_boost IS '0~12 근방 권장; impressions<20 이면 배치에서 0';
COMMENT ON COLUMN place_stats.learned_boost IS '0~12 근방 권장; impressions<20 이면 배치에서 0';

ALTER TABLE course_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_pattern_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_stats ENABLE ROW LEVEL SECURITY;

-- anon: raw 이벤트 INSERT 허용 (기존 events 테이블 정책과 동일 톤)
CREATE POLICY "course_events_anon_insert" ON course_events FOR INSERT WITH CHECK (true);
CREATE POLICY "course_events_anon_select" ON course_events FOR SELECT USING (true);

CREATE POLICY "place_events_anon_insert" ON place_events FOR INSERT WITH CHECK (true);
CREATE POLICY "place_events_anon_select" ON place_events FOR SELECT USING (true);

-- 집계 테이블은 클라이언트 직접 쓰기보다 서비스 롤/Edge 권장 — 읽기만 anon 허용 예시
CREATE POLICY "course_pattern_stats_anon_select" ON course_pattern_stats FOR SELECT USING (true);
CREATE POLICY "place_stats_anon_select" ON place_stats FOR SELECT USING (true);
