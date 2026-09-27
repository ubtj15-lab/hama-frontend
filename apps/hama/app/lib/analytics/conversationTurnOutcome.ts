export const CONVERSATION_TURN_OUTCOMES = ["shown", "empty", "fetch_failed", "suppression_failed"] as const;

export type ConversationTurnOutcome = (typeof CONVERSATION_TURN_OUTCOMES)[number];

export const CONVERSATION_TURN_OUTCOME_SCREEN = "home_conversation";

const recordedTurnIds = new Set<string>();

/**
 * One record per turn for this page load.
 * A component remount does not open a second record for the same turn.
 */
export function claimConversationTurnOutcome(turnId: string): boolean {
  if (!turnId || recordedTurnIds.has(turnId)) return false;
  recordedTurnIds.add(turnId);
  return true;
}

export function resetConversationTurnOutcomeClaims(): void {
  recordedTurnIds.clear();
}

/**
 * Null means the turn is not finished: still searching, waiting for a follow-up lookup,
 * asking for clarification, or replaced before completion.
 * Shown cards win over a partial failure.
 */
export function resolveConversationTurnOutcome(input: {
  pending: boolean;
  shownCardCount: number;
  suppressionFailed: boolean;
  fetchFailed: boolean;
}): ConversationTurnOutcome | null {
  if (input.pending) return null;
  if (input.shownCardCount > 0) return "shown";
  if (input.suppressionFailed) return "suppression_failed";
  if (input.fetchFailed) return "fetch_failed";
  return "empty";
}
