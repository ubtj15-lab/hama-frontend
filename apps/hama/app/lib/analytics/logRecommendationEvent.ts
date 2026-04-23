/**
 * Supabase `recommendation_events` 전용 insert — `events` JSON 스트림과 별도.
 * 실패해도 UI는 죽지 않음 (fire-and-forget).
 */
import type { LogRecommendationEventInput } from "./types";
import { getOrCreateSessionId, getUserId } from "./session";

export type LogRecommendationOptions = {
  /** false 이면 legacy `logEvent` 호출 생략 (기본 true: 중복 수집 허용) */
  alsoEmitLegacyLog?: boolean;
};

/**
 * `recommendation_events` 로 한 줄 적재. Supabase 없으면 `/api`만 시도하고 무시.
 */
export function logRecommendationEvent(
  input: LogRecommendationEventInput,
  _opts: LogRecommendationOptions = {}
): void {
  if (typeof window === "undefined") return;

  try {
    const session_id = getOrCreateSessionId();
    const userId = getUserId();
    const isLoggedIn = userId.startsWith("user_");
    const body = {
      session_id,
      user_id: isLoggedIn ? userId : null,
      event_name: input.event_name,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      scenario: input.scenario ?? null,
      child_age_group: input.child_age_group ?? null,
      weather_condition: input.weather_condition ?? null,
      time_of_day: input.time_of_day ?? null,
      date_time_band: input.date_time_band ?? null,
      rank_position: input.rank_position ?? null,
      source_page: input.source_page ?? null,
      template_id: input.template_id ?? null,
      step_pattern: input.step_pattern ?? null,
      place_ids: input.place_ids ?? [],
      metadata: input.metadata ?? {},
    };

    void fetch("/api/recommendation/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    // ignore
  }
}
