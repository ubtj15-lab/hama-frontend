/**
 * Supabase `recommendation_events.event_name` 및 앱 공통 스키마
 */
export const RECOMMENDATION_EVENT_NAMES = [
  "place_impression",
  "place_click",
  "course_impression",
  "course_click",
  "course_start",
  "decision_complete",
  "reservation_create",
  "reservation_complete",
  "place_feedback",
  "positive_feedback",
  "negative_feedback",
  "quick_exit",
  "course_restore_success",
  "course_restore_fail",
  "recommendation_impression",
  "recommendation_response",
  "correction_event",
  "reject_main_pick",
] as const;

export type RecommendationEventName = (typeof RECOMMENDATION_EVENT_NAMES)[number];

export type RecommendationEntityType = "place" | "course" | "reservation" | null;

/**
 * /api/recommendation/log body — `recommendation_events` 행과 1:1
 */
export type LogRecommendationEventInput = {
  event_name: RecommendationEventName;
  /** 코스 id / place id / reservation id */
  entity_type?: RecommendationEntityType;
  entity_id?: string | null;
  /** 1순위/2순위/3순위 비교 분석용 */
  recommendation_rank?: number | null;
  scenario?: string | null;
  child_age_group?: string | null;
  weather_condition?: string | null;
  time_of_day?: string | null;
  date_time_band?: string | null;
  /** @deprecated recommendation_rank 사용 권장 (하위호환) */
  rank_position?: number | null;
  source_page?: string | null;
  place_snapshot?: Record<string, unknown> | null;
  course_snapshot?: Record<string, unknown> | null;
  created_at?: string | null;
  template_id?: string | null;
  step_pattern?: string | null;
  place_ids?: string[];
  metadata?: Record<string, unknown>;
  analytics_v2?: {
    recommendation_id?: string | null;
    category_clicked?: string | null;
    user_profile?: Record<string, unknown> | null;
    shown_place_ids?: string[] | null;
    main_pick_id?: string | null;
    recommendation_reasons?: Record<string, unknown> | null;
    weights?: Record<string, unknown> | null;
    scenario?: string | null;
    weather?: string | null;
    day_of_week?: number | null;
    time_of_day?: string | null;
    action?: string | null;
    selected_place_id?: string | null;
    reject_reason?: string | null;
    correction_used?: string | null;
    correction_value?: unknown;
    correction_kind?: string | null;
    correction_free_text?: string | null;
  };
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
