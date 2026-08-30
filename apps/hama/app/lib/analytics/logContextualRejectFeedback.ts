/**
 * Phase B contextual reject logger.
 * Isolated from frozen ranking and the client behavior store.
 */
import { getDbUserId, getOrCreateSessionId } from "./session";
import type { ContextualRejectPayload } from "./contextualRejectFeedback";

export function logContextualRejectFeedback(payload: ContextualRejectPayload): void {
  if (typeof window === "undefined") return;
  try {
    const session_id = getOrCreateSessionId() || "unknown";
    const user_id = getDbUserId();
    const body = {
      session_id,
      user_id,
      event_name: "contextual_reject",
      entity_type: "place",
      entity_id: payload.place_id,
      recommendation_rank: payload.shown_position,
      source_page: "results",
      place_ids: [payload.place_id],
      metadata: {
        feedback_source: payload.feedback_source,
        engine_version: payload.engine_version,
        shown_position: payload.shown_position,
        distance_m_at_recommendation: payload.distance_m_at_recommendation,
        shown_place_unverified: payload.shown_place_unverified,
        data_class: "CONTEXTUAL_USER_FEEDBACK",
        query: payload.query,
        qu_snapshot: payload.qu_snapshot,
      },
      analytics_v2: {
        recommendation_id: payload.recommendation_id,
        action: "contextual_reject",
        selected_place_id: payload.place_id,
        reject_reason: payload.reject_reason,
      },
    };
    fetch("/api/recommendation/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch((e) => {
      console.error("logContextualRejectFeedback fetch failed:", e);
    });
  } catch (e) {
    console.error("logContextualRejectFeedback failed:", e);
  }
}
