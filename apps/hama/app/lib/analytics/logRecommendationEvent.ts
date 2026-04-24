/**
 * Supabase `recommendation_events` 전용 insert — `events` JSON 스트림과 별도.
 * 실패해도 UI는 죽지 않음 (fire-and-forget).
 */
import type { LogRecommendationEventInput } from "./types";
import { getDbUserId, getOrCreateSessionId } from "./session";
import { recordBehaviorFromRecommendationEvent } from "@/lib/recommend/behaviorSignalStore";

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
    const userId = getDbUserId();
    const body = {
      session_id,
      user_id: userId,
      event_name: input.event_name,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      recommendation_rank: input.recommendation_rank ?? input.rank_position ?? null,
      scenario: input.scenario ?? null,
      child_age_group: input.child_age_group ?? null,
      weather_condition: input.weather_condition ?? null,
      time_of_day: input.time_of_day ?? null,
      date_time_band: input.date_time_band ?? null,
      source_page: input.source_page ?? null,
      created_at: input.created_at ?? new Date().toISOString(),
      template_id: input.template_id ?? null,
      step_pattern: input.step_pattern ?? null,
      place_ids: input.place_ids ?? [],
      metadata: {
        ...(input.metadata ?? {}),
        place_snapshot: input.place_snapshot ?? null,
        course_snapshot: input.course_snapshot ?? null,
      },
    };

    fetch("/api/recommendation/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch((e) => {
      console.error("logRecommendationEvent fetch failed:", e);
    });

    recordBehaviorFromRecommendationEvent({
      event_name: input.event_name,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      place_ids: input.place_ids ?? [],
      scenario: input.scenario ?? null,
      metadata: { ...(input.metadata ?? {}), place_snapshot: input.place_snapshot ?? undefined },
    });
  } catch (e) {
    console.error("logRecommendationEvent failed:", e);
  }
}
