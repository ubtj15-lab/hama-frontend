/**
 * Phase B — contextual reject payload (observability only).
 *
 * Direction: recommendation session → storage.
 * Never: contextual feedback → ranking / behavior scoring / catalog mutation.
 *
 * FIRST_CLASS_IMPRESSION_ID_DEFERRED: Phase A impressions[] + position is enough for v1.
 * RECOMMENDATION_EVENTS_CHECK_DEFERRED: contextual_reject skips recommendation_events.
 */

import type { RecommendationQuSnapshot, RecommendationShownPlaceSnapshot } from "./recommendationSessionSnapshot";
import { RECOMMENDATION_ENGINE_VERSION } from "./recommendationEngineVersion";
import {
  isRecommendationRejectReason,
  type RecommendationRejectReason,
} from "./recommendationRejectReasons";

export const CONTEXTUAL_REJECT_FEEDBACK_SOURCE = "PRE_VISIT" as const;

export type ContextualRejectPayload = {
  recommendation_id: string;
  place_id: string;
  reject_reason: RecommendationRejectReason;
  shown_position: number | null;
  distance_m_at_recommendation: number | null;
  feedback_source: typeof CONTEXTUAL_REJECT_FEEDBACK_SOURCE;
  engine_version: typeof RECOMMENDATION_ENGINE_VERSION;
  shown_place_unverified: boolean;
  query: string | null;
  qu_snapshot: RecommendationQuSnapshot | null;
};

function asShownPlace(value: unknown): RecommendationShownPlaceSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  if (typeof o.place_id !== "string" || !o.place_id) return null;
  const position = typeof o.position === "number" && Number.isFinite(o.position) ? o.position : null;
  const distance_m =
    typeof o.distance_m === "number" && Number.isFinite(o.distance_m) ? o.distance_m : null;
  return {
    place_id: o.place_id,
    position: position ?? 0,
    name: typeof o.name === "string" ? o.name : null,
    category: typeof o.category === "string" ? o.category : null,
    reason_text: typeof o.reason_text === "string" ? o.reason_text : null,
    distance_m,
    travel_time_min: typeof o.travel_time_min === "number" ? o.travel_time_min : null,
  };
}

/**
 * Resolve a place from the current snapshot, then newest→oldest Phase A impressions.
 * Does not recompute distance.
 */
export function resolveShownPlaceFromSessionHistory(
  history: Record<string, unknown> | null | undefined,
  placeId: string
): RecommendationShownPlaceSnapshot | null {
  const id = String(placeId ?? "").trim();
  if (!id || !history || typeof history !== "object") return null;

  const current = Array.isArray(history.shown_places) ? history.shown_places : [];
  for (const row of current) {
    const shown = asShownPlace(row);
    if (shown?.place_id === id) return shown;
  }

  const impressions = Array.isArray(history.impressions) ? history.impressions : [];
  for (let i = impressions.length - 1; i >= 0; i--) {
    const entry = impressions[i];
    const places =
      entry && typeof entry === "object" && Array.isArray((entry as { shown_places?: unknown }).shown_places)
        ? (entry as { shown_places: unknown[] }).shown_places
        : [];
    for (const row of places) {
      const shown = asShownPlace(row);
      if (shown?.place_id === id) return shown;
    }
  }
  return null;
}

export function buildContextualRejectPayload(input: {
  recommendationId: string | null | undefined;
  placeId: string | null | undefined;
  reason: unknown;
  sessionHistory: Record<string, unknown> | null | undefined;
}): ContextualRejectPayload | null {
  if (!isRecommendationRejectReason(input.reason)) return null;
  const recommendation_id = String(input.recommendationId ?? "").trim();
  const place_id = String(input.placeId ?? "").trim();
  if (!recommendation_id || !place_id) return null;

  const shown = resolveShownPlaceFromSessionHistory(input.sessionHistory, place_id);
  const qu =
    input.sessionHistory?.qu_snapshot && typeof input.sessionHistory.qu_snapshot === "object"
      ? (input.sessionHistory.qu_snapshot as RecommendationQuSnapshot)
      : null;
  const query = typeof input.sessionHistory?.query === "string" ? input.sessionHistory.query : null;

  return {
    recommendation_id,
    place_id,
    reject_reason: input.reason,
    shown_position: shown && shown.position > 0 ? shown.position : null,
    distance_m_at_recommendation: shown ? shown.distance_m : null,
    feedback_source: CONTEXTUAL_REJECT_FEEDBACK_SOURCE,
    engine_version: RECOMMENDATION_ENGINE_VERSION,
    shown_place_unverified: !shown,
    query,
    qu_snapshot: qu,
  };
}

export const CONTEXTUAL_REJECT_EVENT_NAME = "contextual_reject" as const;

export function shouldSkipRecommendationEventsTable(eventName: string): boolean {
  return eventName === CONTEXTUAL_REJECT_EVENT_NAME;
}

/** Row for recommendation_responses. Observability only — never a scoring input. */
export function buildContextualRejectResponseRow(input: {
  recommendationId: string;
  userId: string | null;
  sessionId: string | null;
  payload: ContextualRejectPayload;
  sourcePage?: string | null;
}): {
  recommendation_id: string;
  user_id: string | null;
  session_id: string | null;
  action: typeof CONTEXTUAL_REJECT_EVENT_NAME;
  selected_place_id: string;
  reject_reason: RecommendationRejectReason;
  correction_used: null;
  correction_value: null;
  metadata: Record<string, unknown>;
} {
  return {
    recommendation_id: input.recommendationId,
    user_id: input.userId,
    session_id: input.sessionId,
    action: CONTEXTUAL_REJECT_EVENT_NAME,
    selected_place_id: input.payload.place_id,
    reject_reason: input.payload.reject_reason,
    correction_used: null,
    correction_value: null,
    metadata: {
      source_page: input.sourcePage ?? "results",
      rank_position: input.payload.shown_position,
      feedback_source: input.payload.feedback_source,
      engine_version: input.payload.engine_version,
      shown_position: input.payload.shown_position,
      distance_m_at_recommendation: input.payload.distance_m_at_recommendation,
      shown_place_unverified: input.payload.shown_place_unverified,
      data_class: "CONTEXTUAL_USER_FEEDBACK",
      query: input.payload.query,
      qu_snapshot: input.payload.qu_snapshot,
    },
  };
}
