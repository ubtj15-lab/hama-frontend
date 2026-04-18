-- 참고용: course_pattern_stats / place_stats 갱신 스케치
-- 프로덕션에서는 Edge/cron에서 파라미터화·증분 처리할 것.
-- learned_boost 는 impressions >= 20 일 때만 0 초과 (예시).

-- 예: 최근 30일 course_events 로부터 패턴별 카운트 후 UPSERT
-- pattern_key 는 앱 buildPatternKey 와 동일한 식으로 생성해야 함.

/*
WITH base AS (
  SELECT
    concat_ws(
      '|',
      coalesce(scenario, '-'),
      coalesce(child_age_group, '-'),
      coalesce(weather_condition, '-'),
      coalesce(time_of_day, '-'),
      coalesce(date_time_band, '-'),
      coalesce(template_id, '*'),
      coalesce(step_pattern, '')
    ) AS pattern_key,
    scenario,
    child_age_group,
    weather_condition,
    time_of_day,
    date_time_band,
    coalesce(template_id, '*') AS template_id,
    step_pattern,
    count(*) FILTER (WHERE event_name = 'course_impression') AS impressions,
    count(*) FILTER (WHERE event_name = 'course_card_click') AS clicks,
    count(*) FILTER (WHERE event_name = 'course_detail_view') AS detail_views,
    count(*) FILTER (WHERE event_name = 'course_start_click') AS starts,
    count(*) FILTER (WHERE event_name = 'course_save') AS saves,
    count(*) FILTER (WHERE event_name = 'course_immediate_exit') AS exits
  FROM course_events
  WHERE created_at > now() - interval '30 days'
    AND step_pattern IS NOT NULL
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
)
INSERT INTO course_pattern_stats (
  pattern_key, scenario, child_age_group, weather_condition, time_of_day, date_time_band,
  template_id, step_pattern, impressions, clicks, detail_views, starts, saves, exits,
  ctr, start_rate, save_rate, learned_boost, last_computed_at, updated_at
)
SELECT
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
  detail_views,
  starts,
  saves,
  exits,
  CASE WHEN impressions > 0 THEN clicks::float / impressions ELSE NULL END,
  CASE WHEN impressions > 0 THEN starts::float / impressions ELSE NULL END,
  CASE WHEN impressions > 0 THEN saves::float / impressions ELSE NULL END,
  CASE
    WHEN impressions < 20 THEN 0
    ELSE least(12, 4 * (starts::float / nullif(impressions, 0)) + 3 * (saves::float / nullif(impressions, 0)))
  END,
  now(),
  now()
FROM base
ON CONFLICT (pattern_key) DO UPDATE SET
  impressions = EXCLUDED.impressions,
  clicks = EXCLUDED.clicks,
  detail_views = EXCLUDED.detail_views,
  starts = EXCLUDED.starts,
  saves = EXCLUDED.saves,
  exits = EXCLUDED.exits,
  ctr = EXCLUDED.ctr,
  start_rate = EXCLUDED.start_rate,
  save_rate = EXCLUDED.save_rate,
  learned_boost = EXCLUDED.learned_boost,
  last_computed_at = EXCLUDED.last_computed_at,
  updated_at = EXCLUDED.updated_at;
*/

-- place_events → place_stats 예시는 place_id 그룹으로 동일 패턴 작성.
