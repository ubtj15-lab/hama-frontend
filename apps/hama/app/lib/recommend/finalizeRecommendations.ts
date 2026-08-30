/**
 * Shared recommendation finalizer — production Results and the simulator
 * both end here. Pure: no React, no fetch, no browser APIs.
 *
 * Order:
 *   merged ranked ∪ scored pool
 *   → kids-safety eligibility (nightlife never re-enters)
 *   → applyDiscoveryRerank once on the remaining pool
 *   → TOP-N deck
 *
 * Session suppression / bucket diversity stay outside (runtime-only).
 */

import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { isAlcoholNightlifeHaystack } from "./childFriendlyScore";
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

function shouldExcludeNightlifeForKids(parsed: ScenarioObject): boolean {
  return parsed.withKids === true;
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
  if (!shouldExcludeNightlifeForKids(parsed)) return pool;
  return pool.filter((item) => !isAlcoholNightlifeHaystack(discoveryItemHaystack(item)));
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
}): DiscoveryRerankResult<T> & { eligiblePool: DiscoveryRerankItem<T>[] } {
  const deckSize = input.deckSize ?? 3;
  const merged = mergeDiscoveryPool(input.ranked, input.scoredPool ?? []);
  const safe = applyKidsSafetyToDiscoveryPool(merged, input.parsed);
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
}): FinalizeRecommendationsResult {
  const ranked = input.ranked.map(scoredToDiscovery);
  const scoredPool = (input.scoredPool ?? []).map(scoredToDiscovery);
  const result = finalizeDiscoveryPool({
    query: input.query,
    parsed: input.parsed,
    ranked,
    scoredPool,
    deckSize: input.deckSize,
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
