import { parseScenarioIntent } from "@/lib/scenarioEngine/intentClassification";
import type { ConversationContext } from "./types";
import { detectRefinementType } from "./refinement";
import { parseTurnIntent } from "./parseTurn";
import { mergeIntent } from "./mergeIntent";
import { applyConversationMemory } from "./memory";
import { saveConversationContext } from "./storage";

function makeSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr.filter((x) => x != null && x !== ""))] as T[];
}

/**
 * 사용자 발화 1턴을 반영해 ConversationContext 를 갱신하고 저장합니다.
 */
export function processConversationTurn(
  text: string,
  previous: ConversationContext | null,
  options?: { persist?: boolean }
): ConversationContext {
  const raw = String(text ?? "").trim();
  const persist = options?.persist !== false;

  const sessionId = previous?.sessionId ?? makeSessionId();
  if (previous?.turns.length) {
    const lastUser = [...previous.turns].reverse().find((t) => t.role === "user");
    if (lastUser?.text === raw) {
      return previous;
    }
  }

  const userTurn = { role: "user" as const, text: raw, timestamp: Date.now() };
  const turns = [...(previous?.turns ?? []), userTurn];
  const cumulativeText = [previous?.cumulativeText, raw].filter(Boolean).join(" · ");

  if (!previous) {
    const currentIntent = applyConversationMemory(parseScenarioIntent(raw), {});
    const ctx: ConversationContext = {
      sessionId,
      turns,
      currentIntent,
      cumulativeText: raw,
    };
    if (persist) saveConversationContext(ctx);
    return ctx;
  }

  const refinement = detectRefinementType(raw, previous);
  const parsed = parseTurnIntent(raw, previous, refinement);

  let nextIntent = mergeIntent(previous.currentIntent, parsed.partialIntent, refinement, {
    lockedFields: new Set(previous.lockedFields ?? []),
    preserveOnReset:
      refinement === "new_request" ? ["timeOfDay", "distanceTolerance", "region"] : undefined,
  });

  let lockedFields = [...(previous.lockedFields ?? [])];
  if (parsed.suggestedLocks?.length) {
    lockedFields = uniq([...lockedFields, ...parsed.suggestedLocks]);
  }

  let rejectedPlaceIds = [...(previous.rejectedPlaceIds ?? [])];
  let rejectedCategories = [...(previous.rejectedCategories ?? [])];
  let rejectedTags = [...(previous.rejectedTags ?? [])];

  if (refinement === "new_request") {
    rejectedPlaceIds = [];
    rejectedCategories = [];
    rejectedTags = [];
  }

  if (parsed.rejection?.rejectShownPlaces && previous.lastRecommendations?.placeIds?.length) {
    rejectedPlaceIds = uniq([...rejectedPlaceIds, ...previous.lastRecommendations.placeIds]);
  }
  if (parsed.rejection?.addRejectedCategory) {
    rejectedCategories = uniq([...rejectedCategories, parsed.rejection.addRejectedCategory]);
  }
  if (parsed.rejection?.removeMenuIntent) {
    const rm = parsed.rejection.removeMenuIntent;
    nextIntent.menuIntent = (nextIntent.menuIntent ?? []).filter((m) => m !== rm);
    rejectedTags = uniq([...rejectedTags, rm]);
  }
  if (parsed.rejection?.broadenFood) {
    delete (nextIntent as any).foodSubCategory;
  }

  const ctx: ConversationContext = {
    sessionId,
    turns,
    currentIntent: nextIntent,
    lockedFields: lockedFields.length ? lockedFields : undefined,
    rejectedPlaceIds: rejectedPlaceIds.length ? rejectedPlaceIds : undefined,
    rejectedCategories: rejectedCategories.length ? rejectedCategories : undefined,
    rejectedTags: rejectedTags.length ? rejectedTags : undefined,
    cumulativeText,
    lastRecommendations: previous.lastRecommendations,
    clarificationNeeded: refinement === "clarify" ? true : undefined,
  };

  nextIntent = applyConversationMemory(nextIntent, {
    rejectedPlaceIds: ctx.rejectedPlaceIds,
    rejectedCategories: ctx.rejectedCategories,
    rejectedTags: ctx.rejectedTags,
  });
  const out: ConversationContext = { ...ctx, currentIntent: nextIntent };

  if (persist) saveConversationContext(out);
  return out;
}
