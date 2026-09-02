/**
 * Shared recommendation finalizer — production Results and the simulator
 * both end here. Pure: no React, no fetch, no browser APIs.
 *
 * Order:
 *   merged ranked ∪ scored pool
 *   → kids-safety eligibility (adult venues never re-enter when kids context)
 *   → local distance eligibility (ordinary local hard cap; no far TOP3 backfill)
 *   → applyDiscoveryRerank on the remaining pool
 *   → TOP-N deck
 *   → optional DATE session-local repeat avoidance (avoidPlaceIds only;
 *     empty avoid list leaves the discovery deck unchanged)
 *
 * Browser session storage stays outside this module.
 */

import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { isHighConfidenceAdultVenueHaystack } from "./childFriendlyScore";
import { applyLocalDistanceSafety } from "./localDistanceSafety";
import {
  applyDiscoveryRerank,
  DISCOVERY_POOL_LIMIT,
  toDiscoveryItem,
  type DiscoveryClassification,
  type DiscoveryItemDebug,
  type DiscoveryRerankItem,
  type DiscoveryRerankResult,
} from "./discoveryRole";
import type { ScoredRecommendItem } from "./scoring";
import {
  applyRepeatAvoidanceToOrderedDeck,
  shouldApplyDateRepeatAvoidance,
} from "./dateRepeatAvoidance";

export type FinalizeRecommendationsResult = {
  deck: ScoredRecommendItem[];
  eligiblePool: ScoredRecommendItem[];
  classification: DiscoveryClassification;
  applied: boolean;
  debug: DiscoveryItemDebug[];
};

function discoveryItemHaystack<T>(item: DiscoveryRerankItem<T>): string {
  return [
    item.name,
    item.category,
    ...(item.tags ?? []),
    ...(item.mood ?? []),
    item.description ?? "",
    ...(item.searchKeywords ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

const KIDS_PURPOSE_TRIGGERS = new Set(["kids_cafe", "indoor_play"]);

/** Explicit child context only — bare 가족 / scenario=family does not activate. */
export function isExplicitKidsRecommendationContext(parsed: ScenarioObject): boolean {
  if (parsed.withKids === true) return true;
  const uq = parsed.queryUnderstanding;
  if ((uq?.companionIntents ?? []).includes("child")) return true;
  if ((uq?.purposeIntents ?? []).some((p) => KIDS_PURPOSE_TRIGGERS.has(p))) return true;
  return false;
}

function mergeDiscoveryPool<T>(
  ranked: DiscoveryRerankItem<T>[],
  scoredPool: DiscoveryRerankItem<T>[]
): DiscoveryRerankItem<T>[] {
  const byId = new Map<string, DiscoveryRerankItem<T>>();
  for (const item of ranked) {
    if (!item.id || byId.has(item.id)) continue;
    byId.set(item.id, item);
  }
  for (const item of scoredPool) {
    if (!item.id || byId.has(item.id)) continue;
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function applyKidsSafetyToDiscoveryPool<T>(
  pool: DiscoveryRerankItem<T>[],
  parsed: ScenarioObject
): DiscoveryRerankItem<T>[] {
  if (!isExplicitKidsRecommendationContext(parsed)) return pool;
  return pool.filter((item) => !isHighConfidenceAdultVenueHaystack(discoveryItemHaystack(item)));
}

function distanceKmOfDiscoveryItem<T>(item: DiscoveryRerankItem<T>): number | null {
  const payload = item.payload as { card?: { distanceKm?: number | null }; distanceKm?: number | null } | undefined;
  const fromPayload = payload?.card?.distanceKm ?? payload?.distanceKm;
  if (typeof fromPayload === "number" && Number.isFinite(fromPayload)) return fromPayload;
  return null;
}

function applyLocalDistanceToDiscoveryPool<T>(
  pool: DiscoveryRerankItem<T>[],
  query: string,
  parsed: ScenarioObject
): DiscoveryRerankItem<T>[] {
  return applyLocalDistanceSafety(pool, {
    query,
    parsed,
    distanceKmOf: distanceKmOfDiscoveryItem,
    placeNameOf: (item) => item.name,
  });
}

/**
 * Generic pool finalizer. `applyDiscoveryRerank` runs exactly once.
 */
export function finalizeDiscoveryPool<T>(input: {
  query: string;
  parsed: ScenarioObject;
  ranked: DiscoveryRerankItem<T>[];
  scoredPool?: DiscoveryRerankItem<T>[];
  deckSize?: number;
  avoidPlaceIds?: readonly string[];
}): DiscoveryRerankResult<T> & { eligiblePool: DiscoveryRerankItem<T>[] } {
  const deckSize = input.deckSize ?? 3;
  const merged = mergeDiscoveryPool(input.ranked, input.scoredPool ?? []);
  const kidsSafe = applyKidsSafetyToDiscoveryPool(merged, input.parsed);
  const safe = applyLocalDistanceToDiscoveryPool(kidsSafe, input.query, input.parsed);
  const byScore = [...safe].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.id.localeCompare(b.id)
  );
  const eligiblePool = byScore.slice(0, Math.max(deckSize, DISCOVERY_POOL_LIMIT));
  const naturalDeckIds = input.ranked
    .map((r) => r.id)
    .filter((id) => eligiblePool.some((p) => p.id === id));
  const result = applyDiscoveryRerank(eligiblePool, input.query, input.parsed, {
    deckSize,
    poolLimit: DISCOVERY_POOL_LIMIT,
    naturalDeckIds,
  });
  const avoid = (input.avoidPlaceIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean);
  if (
    result.applied &&
    avoid.length > 0 &&
    shouldApplyDateRepeatAvoidance(input.query, input.parsed, result.classification)
  ) {
    const expanded = applyDiscoveryRerank(eligiblePool, input.query, input.parsed, {
      deckSize: Math.max(deckSize, eligiblePool.length),
      poolLimit: DISCOVERY_POOL_LIMIT,
      naturalDeckIds,
    });
    const nextDeck = applyRepeatAvoidanceToOrderedDeck(expanded.deck, avoid, deckSize);
    return { ...result, deck: nextDeck, eligiblePool };
  }
  return { ...result, eligiblePool };
}

function scoredToDiscovery(item: ScoredRecommendItem): DiscoveryRerankItem<ScoredRecommendItem> {
  const base = toDiscoveryItem(item.card, item.breakdown.finalScore ?? 0);
  return { ...base, payload: item };
}

export function finalizeRecommendations(input: {
  query: string;
  parsed: ScenarioObject;
  ranked: ScoredRecommendItem[];
  scoredPool?: ScoredRecommendItem[];
  deckSize?: number;
  avoidPlaceIds?: readonly string[];
}): FinalizeRecommendationsResult {
  const ranked = input.ranked.map(scoredToDiscovery);
  const scoredPool = (input.scoredPool ?? []).map(scoredToDiscovery);
  const result = finalizeDiscoveryPool({
    query: input.query,
    parsed: input.parsed,
    ranked,
    scoredPool,
    deckSize: input.deckSize,
    avoidPlaceIds: input.avoidPlaceIds,
  });
  const byId = new Map<string, ScoredRecommendItem>();
  for (const item of [...input.ranked, ...(input.scoredPool ?? [])]) {
    if (!byId.has(item.card.id)) byId.set(item.card.id, item);
  }
  return {
    deck: result.deck.map((d) => d.payload ?? byId.get(d.id)!).filter(Boolean),
    eligiblePool: result.eligiblePool.map((d) => d.payload ?? byId.get(d.id)!).filter(Boolean),
    classification: result.classification,
    applied: result.applied,
    debug: result.debug,
  };
}
