import { parseScenarioIntent } from "@/lib/scenarioEngine/intentClassification";
import { explicitVenueChoice } from "./followUp";
import type { ConversationContext } from "./types";
import { detectRefinementType } from "./refinement";
import { parseTurnIntent } from "./parseTurn";
import { mergeIntent } from "./mergeIntent";
import { applyConversationMemory } from "./memory";
import { saveConversationContext } from "./storage";
import { nextLinkedPurposes, detectLinkedFoodPurpose, validShownPlayCards } from "./linkedPurpose";
import { regionClarificationFor, withNamedRegion } from "./namedRegion";
import { AMBIGUOUS_PLACE_PROMPT, classifyShownExclusion } from "./shownReference";
import { classifyRequestCapability, diningOutCategory } from "./capability";
import { parseQueryNegation } from "@/lib/scenarioEngine/negationUnderstanding";
import type { FoodSubCategory } from "@/lib/scenarioEngine/types";

function makeSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr.filter((x) => x != null && x !== ""))] as T[];
}

function foodSubForRejected(category: string | undefined): FoodSubCategory | null {
  const token = String(category ?? "").toUpperCase();
  if (token === "CHINESE" || token === "JAPANESE" || token === "KOREAN" || token === "WESTERN" || token === "FASTFOOD") {
    return token;
  }
  return null;
}

/**
 * 사용자 발화 1턴을 반영해 ConversationContext 를 갱신하고 저장합니다.
 */
export function processConversationTurn(
  text: string,
  previous: ConversationContext | null,
  options?: { persist?: boolean; turnId?: string }
): ConversationContext {
  const raw = String(text ?? "").trim();
  const persist = options?.persist !== false;
  const turnId = options?.turnId;

  const sessionId = previous?.sessionId ?? makeSessionId();
  if (previous?.turns.length) {
    const lastUser = [...previous.turns].reverse().find((t) => t.role === "user");
    if (turnId) {
      if (lastUser?.turnId === turnId) return previous;
    } else if (lastUser?.text === raw) {
      return previous;
    }
  }

  const userTurn = {
    role: "user" as const,
    text: raw,
    timestamp: Date.now(),
    ...(turnId ? { turnId } : {}),
  };
  const turns = [...(previous?.turns ?? []), userTurn];
  const cumulativeText = [previous?.cumulativeText, raw].filter(Boolean).join(" · ");

  if (!previous) {
    const decision = classifyRequestCapability(raw, null);
    let currentIntent = withNamedRegion(applyConversationMemory(parseScenarioIntent(raw), {}), raw);
    if (!decision.holdRecommendations && !currentIntent.intentCategory) {
      const dining = diningOutCategory(raw);
      if (dining) currentIntent = { ...currentIntent, intentCategory: dining };
    }
    const regionQuestion = regionClarificationFor(raw);
    const ctx: ConversationContext = {
      sessionId,
      turns,
      currentIntent,
      cumulativeText: raw,
      linkedPurposes: nextLinkedPurposes(undefined, raw, "new_request"),
      clarificationNeeded: regionQuestion || decision.holdRecommendations ? true : undefined,
      regionClarification: regionQuestion ?? undefined,
      clarificationPrompt: decision.prompt ?? undefined,
      holdRecommendations: decision.holdRecommendations ? true : undefined,
      capabilityClass: decision.requestClass === "search" ? undefined : decision.requestClass,
      capabilityTopic: decision.topic ?? undefined,
      responseKind: decision.responseKind ?? undefined,
    };
    if (persist) saveConversationContext(ctx);
    return ctx;
  }

  const decision = classifyRequestCapability(raw, previous);
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

  const shownExclusion = classifyShownExclusion(raw, previous);
  const ambiguousPlace = shownExclusion.kind === "ambiguous";
  if (!ambiguousPlace && shownExclusion.kind === "ids") {
    rejectedPlaceIds = uniq([...rejectedPlaceIds, ...shownExclusion.ids]);
  } else if (!ambiguousPlace && shownExclusion.kind === "all" && previous.lastRecommendations?.placeIds?.length) {
    rejectedPlaceIds = uniq([...rejectedPlaceIds, ...previous.lastRecommendations.placeIds]);
  } else if (
    !ambiguousPlace &&
    parsed.rejection?.rejectShownPlaces &&
    previous.lastRecommendations?.placeIds?.length
  ) {
    rejectedPlaceIds = uniq([...rejectedPlaceIds, ...previous.lastRecommendations.placeIds]);
  }
  if (parsed.rejection?.addRejectedCategory) {
    rejectedCategories = uniq([...rejectedCategories, parsed.rejection.addRejectedCategory]);
    const dropped = foodSubForRejected(parsed.rejection.addRejectedCategory);
    if (dropped && nextIntent.foodSubCategory === dropped) delete nextIntent.foodSubCategory;
  }
  const utteranceNegation = parseQueryNegation(raw);
  if (utteranceNegation.excludedVenues.includes("kids_cafe")) {
    rejectedTags = uniq([...rejectedTags, "키즈카페", "놀이카페"]);
    nextIntent.menuIntent = (nextIntent.menuIntent ?? []).filter((item) => item !== "키즈카페" && item !== "놀이카페");
    if (!nextIntent.menuIntent.length) delete nextIntent.menuIntent;
  }
  if (parsed.rejection?.removeMenuIntent) {
    const rm = parsed.rejection.removeMenuIntent;
    nextIntent.menuIntent = (nextIntent.menuIntent ?? []).filter((m) => m !== rm);
    rejectedTags = uniq([...rejectedTags, rm]);
  }
  if (parsed.rejection?.broadenFood || parsed.rejection?.removeFoodSubCategory) {
    const dropped = foodSubForRejected(parsed.rejection?.addRejectedCategory);
    if (!dropped || nextIntent.foodSubCategory === dropped) delete (nextIntent as any).foodSubCategory;
  }
  if (refinement === "broaden" && /조용|한적|잔잔/.test(raw) && /아니어도|괜찮아|상관없|뭐든\s*좋아/.test(raw)) {
    const vibe = (nextIntent.vibePreference ?? []).filter((item) => item !== "calm");
    if (vibe.length) nextIntent.vibePreference = vibe;
    else delete nextIntent.vibePreference;
    if (nextIntent.activityLevel === "calm") delete nextIntent.activityLevel;
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
    clarificationNeeded: ambiguousPlace || refinement === "clarify" ? true : undefined,
    clarificationPrompt: ambiguousPlace ? AMBIGUOUS_PLACE_PROMPT : undefined,
  };

  if (!decision.holdRecommendations && !nextIntent.intentCategory) {
    const dining = diningOutCategory(raw);
    if (dining) nextIntent = { ...nextIntent, intentCategory: dining };
  }

  nextIntent = withNamedRegion(
    applyConversationMemory(nextIntent, {
      rejectedPlaceIds: ctx.rejectedPlaceIds,
      rejectedCategories: ctx.rejectedCategories,
      rejectedTags: ctx.rejectedTags,
    }),
    raw,
    previous.currentIntent.region
  );
  const chosenVenue =
    explicitVenueChoice(raw) &&
    (previous.capabilityTopic === "venue_shift" || /다른\s*(종류|업종|유형)/.test(raw))
      ? explicitVenueChoice(raw)
      : null;
  if (chosenVenue) {
    const fresh = parseScenarioIntent(raw);
    nextIntent = {
      ...nextIntent,
      intentCategory: chosenVenue,
      intentType: "search_strict",
      intentStrict: true,
      rawQuery: raw,
      queryUnderstanding: fresh.queryUnderstanding,
      region: nextIntent.region ?? previous.currentIntent.region,
      withKids: previous.currentIntent.withKids,
      indoorPreferred: previous.currentIntent.indoorPreferred,
      distanceTolerance: previous.currentIntent.distanceTolerance,
      weatherHint: previous.currentIntent.weatherHint,
    };
  }
  const regionQuestion = regionClarificationFor(raw);
  const mealOnly = detectLinkedFoodPurpose(raw);
  const playIntent = mealOnly
    ? {
        ...nextIntent,
        distanceTolerance: previous.currentIntent.distanceTolerance,
        mealRequired: previous.currentIntent.mealRequired,
      }
    : nextIntent;
  const keptPlay = validShownPlayCards(previous.lastRecommendations?.cards)
    ? previous.lastRecommendations!.cards
    : validShownPlayCards(previous.frozenPlayCards)
      ? previous.frozenPlayCards
      : undefined;
  const out: ConversationContext = {
    ...ctx,
    currentIntent: playIntent,
    linkedPurposes: nextLinkedPurposes(previous.linkedPurposes, raw, refinement),
    clarificationNeeded:
      regionQuestion || ambiguousPlace || refinement === "clarify" || decision.holdRecommendations
        ? true
        : undefined,
    clarificationPrompt: decision.prompt ?? (ambiguousPlace ? AMBIGUOUS_PLACE_PROMPT : undefined),
    holdRecommendations: decision.holdRecommendations ? true : undefined,
    capabilityClass: decision.requestClass === "search" ? undefined : decision.requestClass,
    capabilityTopic: decision.topic ?? undefined,
    responseKind: decision.responseKind ?? undefined,
    regionClarification: regionQuestion ?? undefined,
    shownPlayCards: previous.shownPlayCards,
    shownPlayKey: previous.shownPlayKey,
    frozenPlayCards: decision.holdRecommendations ? previous.frozenPlayCards : mealOnly ? keptPlay : undefined,
    dialogueHistory: previous.dialogueHistory,
  };

  if (persist) saveConversationContext(out);
  return out;
}
