/**
 * Home situation slot selection. Presentation only.
 * No ranking scores, no engine calls, no personalization weights.
 */

import {
  DEFAULT_HOME_SLOT_IDS,
  EMPTY_HOME_PERSONALIZATION,
  HOME_SITUATION_CANDIDATES,
  MAX_HOME_SITUATION_SLOTS,
  getHomeSituationCandidate,
  type HomeDaypart,
  type HomePersonalizationContext,
  type HomeSemanticFamily,
  type HomeSituationCandidate,
} from "./homeSituationCandidates";

export type HomeSituationContext = {
  now: Date;
  weekend: boolean;
  daypart: HomeDaypart;
  /** V4.1: always false. Weather is not available on Home. */
  rainy: boolean;
};

export const HOME_SITUATION_DECK_COUNT = 3;

const FAMILY_FILL_ORDER: HomeSemanticFamily[] = [
  "family",
  "date",
  "food",
  "outdoor",
  "indoor",
  "culture",
  "relax",
  "discovery",
];

export function homeDaypartFromHour(hour: number): HomeDaypart {
  if (hour < 11) return "morning";
  if (hour < 14) return "lunch";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function buildHomeSituationContext(now: Date): HomeSituationContext {
  const day = now.getDay();
  return {
    now,
    weekend: day === 0 || day === 6,
    daypart: homeDaypartFromHour(now.getHours()),
    rainy: false,
  };
}

function isEligible(candidate: HomeSituationCandidate, ctx: HomeSituationContext): boolean {
  if (candidate.contextHints?.rainy && !ctx.rainy) return false;
  return true;
}

function idsToCandidates(ids: readonly string[]): HomeSituationCandidate[] {
  return ids
    .map((id) => getHomeSituationCandidate(id))
    .filter((c): c is HomeSituationCandidate => Boolean(c));
}

/** Explicit decks. No numeric weights. */
function primaryDeckIds(ctx: HomeSituationContext): string[] {
  if (ctx.weekend && ctx.daypart === "afternoon") {
    return ["family_outing", "date", "outdoor_walk", "discovery"];
  }
  if (ctx.weekend && ctx.daypart === "evening") {
    return ["date", "food", "indoor", "relax"];
  }
  if (ctx.weekend && ctx.daypart === "morning") {
    return ["family_outing", "outdoor_walk", "food", "date"];
  }
  if (!ctx.weekend && ctx.daypart === "morning") {
    return ["food", "relax", "outdoor_walk", "date"];
  }
  if (!ctx.weekend && ctx.daypart === "afternoon") {
    return ["culture", "outdoor_walk", "cafe_sweet", "date"];
  }
  if (!ctx.weekend && ctx.daypart === "evening") {
    return ["date", "food", "relax", "indoor"];
  }
  return [...DEFAULT_HOME_SLOT_IDS];
}

function fillDiverse(exclude: Set<string>, ctx: HomeSituationContext, count: number): string[] {
  const next: string[] = [];
  const take = (candidate: HomeSituationCandidate | undefined) => {
    if (!candidate || exclude.has(candidate.id) || !isEligible(candidate, ctx)) return;
    if (next.length >= count) return;
    next.push(candidate.id);
    exclude.add(candidate.id);
  };

  for (const family of FAMILY_FILL_ORDER) {
    take(HOME_SITUATION_CANDIDATES.find((c) => c.semanticFamily === family && !exclude.has(c.id)));
  }
  for (const candidate of HOME_SITUATION_CANDIDATES) {
    take(candidate);
  }
  return next;
}

export function situationDecksForContext(ctx: HomeSituationContext): string[][] {
  const used = new Set<string>();
  const a = primaryDeckIds(ctx).filter((id) => {
    const c = getHomeSituationCandidate(id);
    return c && isEligible(c, ctx);
  });
  a.forEach((id) => used.add(id));
  while (a.length < MAX_HOME_SITUATION_SLOTS) {
    const extra = fillDiverse(used, ctx, 1);
    if (!extra.length) break;
    a.push(...extra);
  }
  const b = fillDiverse(used, ctx, MAX_HOME_SITUATION_SLOTS);
  const c = fillDiverse(used, ctx, MAX_HOME_SITUATION_SLOTS);
  return [a.slice(0, MAX_HOME_SITUATION_SLOTS), b, c];
}

export function selectHomeSituationSlots(input: {
  now: Date;
  deckIndex?: number;
  personalization?: HomePersonalizationContext;
}): {
  slots: HomeSituationCandidate[];
  deckIndex: number;
  deckCount: number;
} {
  const ctx = buildHomeSituationContext(input.now);
  const decks = situationDecksForContext(ctx);
  const rawIndex = input.deckIndex ?? 0;
  const deckIndex = ((rawIndex % HOME_SITUATION_DECK_COUNT) + HOME_SITUATION_DECK_COUNT) % HOME_SITUATION_DECK_COUNT;
  const personalization = input.personalization ?? EMPTY_HOME_PERSONALIZATION;
  void personalization;
  const slots = idsToCandidates(decks[deckIndex] ?? decks[0] ?? DEFAULT_HOME_SLOT_IDS);
  return { slots, deckIndex, deckCount: HOME_SITUATION_DECK_COUNT };
}
