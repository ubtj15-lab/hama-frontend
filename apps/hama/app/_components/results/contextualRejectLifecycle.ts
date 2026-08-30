/**
 * Results-owned contextual-reject context.
 * Survives RecommendationList remount / deck refresh.
 * Distance still comes from Phase A sessionHistory (not recomputed).
 */
import { buildContextualRejectPayload } from "@/lib/analytics/contextualRejectFeedback";
import type { ContextualRejectPayload } from "@/lib/analytics/contextualRejectFeedback";

export type FrozenContextualReject = {
  placeId: string;
  recommendationId: string | null;
  sessionHistory: Record<string, unknown>;
};

function cloneSessionHistory(
  history: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!history || typeof history !== "object") return {};
  try {
    return JSON.parse(JSON.stringify(history)) as Record<string, unknown>;
  } catch {
    return { ...history };
  }
}

export function freezeContextualRejectContext(input: {
  placeId: string | null | undefined;
  recommendationId: string | null | undefined;
  sessionHistory: Record<string, unknown> | null | undefined;
}): FrozenContextualReject | null {
  const placeId = String(input.placeId ?? "").trim();
  if (!placeId) return null;
  const recommendationId = String(input.recommendationId ?? "").trim() || null;
  return {
    placeId,
    recommendationId,
    sessionHistory: cloneSessionHistory(input.sessionHistory),
  };
}

export function buildFrozenContextualRejectPayload(
  frozen: FrozenContextualReject | null | undefined,
  reason: unknown
): ContextualRejectPayload | null {
  if (!frozen) return null;
  return buildContextualRejectPayload({
    recommendationId: frozen.recommendationId,
    placeId: frozen.placeId,
    reason,
    sessionHistory: frozen.sessionHistory,
  });
}
