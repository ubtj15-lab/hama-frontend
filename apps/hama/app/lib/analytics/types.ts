/**
 * Supabase `recommendation_events.event_name` 및 앱 공통 스키마
 */
export const RECOMMENDATION_EVENT_NAMES = [
  "place_impression",
  "place_click",
  "course_impression",
  "course_click",
  "course_start",
  "reservation_create",
  "reservation_complete",
  "course_restore_success",
  "course_restore_fail",
] as const;

export type RecommendationEventName = (typeof RECOMMENDATION_EVENT_NAMES)[number];

export type RecommendationEntityType = "place" | "course" | "reservation" | "session" | null;

/**
 * /api/recommendation/log body — `recommendation_events` 행과 1:1
 */
export type LogRecommendationEventInput = {
  event_name: RecommendationEventName;
  /** 코스 id / place id / reservation id */
  entity_type?: RecommendationEntityType;
  entity_id?: string | null;
  scenario?: string | null;
  child_age_group?: string | null;
  weather_condition?: string | null;
  time_of_day?: string | null;
  date_time_band?: string | null;
  rank_position?: number | null;
  source_page?: string | null;
  template_id?: string | null;
  step_pattern?: string | null;
  place_ids?: string[];
  metadata?: Record<string, unknown>;
};

export type RecommendationPatternStatRow = {
  pattern_key: string;
  scenario: string | null;
  child_age_group: string | null;
  weather_condition: string | null;
  time_of_day: string | null;
  date_time_band: string | null;
  template_id: string | null;
  step_pattern: string | null;
  impressions: number;
  clicks: number;
  starts: number;
  reservations: number;
  completes: number;
  restore_fails: number;
  ctr: number | null;
  start_rate: number | null;
  reservation_rate: number | null;
  completion_rate: number | null;
  learned_boost: number;
};
