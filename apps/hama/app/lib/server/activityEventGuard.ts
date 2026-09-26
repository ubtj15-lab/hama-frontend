import { HamaEvents } from "@/lib/analytics/events";
import { RECOMMENDATION_EVENT_NAMES } from "@/lib/analytics/types";
import { CONTEXTUAL_REJECT_EVENT_NAME } from "@/lib/analytics/contextualRejectFeedback";
import { HamaEventNames } from "@/lib/hamaEventNames";

export const MAX_ACTIVITY_EVENTS = 20;
export const MAX_ACTIVITY_JSON_CHARS = 8_000;

const EXTRA_LOG_TYPES = [
  "bottom_nav_click",
  "call_click",
  "course_click",
  "course_cta_click",
  "course_debug",
  "course_detail_view",
  "course_impression",
  "course_random_fallback_blocked",
  "course_restore_fail",
  "course_restore_success",
  "course_route_enter",
  "course_start",
  "course_start_click",
  "home_alert_click",
  "home_card_swipe",
  "home_course_pick",
  "home_search_icon_click",
  "mission_start",
  "navigate_click",
  "naver_place_check_click",
  "place_click",
  "place_name_search_impression",
  "place_open_kakao",
  "place_open_naver",
  "recommend_detail_click",
  "recommend_directions_click",
  "recommend_feedback",
  "recommend_intent_fit_adjusted",
  "recommend_phone_click",
  "recommend_safety_filter_applied",
  "result_impression",
  "reserve_continue_course",
  "reserve_done_call",
  "reserve_done_directions",
  "reserve_done_first_stop_directions",
  "reserve_flow_complete",
  "reserve_flow_start",
  "reserve_naver_click",
  "reserve_step_pick_next",
  "search_recommend_card_click",
  "search_result_card_click",
  "search_submit",
  "search_v2_category_chip",
  "search_v2_results",
] as const;

const PRODUCT_LOG_TYPES = new Set<string>([
  ...Object.values(HamaEvents),
  ...Object.values(HamaEventNames),
  ...EXTRA_LOG_TYPES,
]);

const HAMA_EVENT_NAMES = new Set<string>([
  ...Object.values(HamaEventNames),
  ...Object.values(HamaEvents),
]);

export const RECOMMENDATION_LOG_EVENTS = new Set<string>([
  ...RECOMMENDATION_EVENT_NAMES,
  CONTEXTUAL_REJECT_EVENT_NAME,
]);

export function isAllowedProductLogType(type: string): boolean {
  return PRODUCT_LOG_TYPES.has(type);
}

export function isAllowedHamaEventName(name: string): boolean {
  return HAMA_EVENT_NAMES.has(name);
}

export function isAllowedRecommendationLogEvent(name: string): boolean {
  return RECOMMENDATION_LOG_EVENTS.has(name);
}

export function clipText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function boundedRecord(value: unknown, maxChars = MAX_ACTIVITY_JSON_CHARS): Record<string, unknown> | null {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const text = JSON.stringify(value);
    if (text.length > maxChars) return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
