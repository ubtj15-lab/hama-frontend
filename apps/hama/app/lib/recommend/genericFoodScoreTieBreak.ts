/**
 * Deterministic secondary order for generic FOOD score ties.
 *
 * Tie policy for GENERIC FOOD:
 * - when finalScore is exactly equal: prefer smaller actual distanceKm
 * - if still equal: preserve existing stable order (by returning 0)
 *
 * Recommendation-path duplicate collapse:
 * - provides a helper that removes exact duplicate real-world places within
 *   each exact finalScore tie group (without mutating finalScore).
 */

import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import type { HomeCard } from "@/lib/storeTypes";
import {
  hasStrongerDiningOutOverrideContext,
  isNeutralGenericDiningOutQuery,
} from "@/lib/scenarioEngine/genericDiningOut";
import { matchNamedFoodPreset } from "./namedFoodPresets";

// "먹고 싶어" / "먹고" forms are common in Home FOOD cards.
const MEAL_GENERIC_RE = /먹(?:을|어|지|고)|밥|식당|맛집|외식|든든|뭐\s*먹지/;
const DATE_RE = /데이트|연인|커플/;

export function normalizeFoodTieQuery(query: string): string {
  return String(query ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isGenericFoodScoreTieBreakQuery(
  query: string,
  parsed: ScenarioObject | null | undefined
): boolean {
  if (!parsed) return false;
  if (parsed.recommendationMode === "course" || parsed.intentType === "course_generation") {
    return false;
  }
  if (parsed.catalogMenu?.catalogMenuPrimary) return false;
  if ((parsed.menuIntent ?? []).length > 0) return false;
  const raw = String(query ?? parsed.rawQuery ?? "").trim();
  if (!raw) return false;
  if (DATE_RE.test(raw)) return false;
  if (hasStrongerDiningOutOverrideContext(raw)) return false;
  if (/실내/.test(raw) && /놀/.test(raw)) return false;
  if (matchNamedFoodPreset(raw)) return false;
  if (isNeutralGenericDiningOutQuery(raw)) return true;
  if (!MEAL_GENERIC_RE.test(raw)) return false;
  return true;
}

export type FoodTieScoreFields = {
  id: string;
  finalScore: number;
  distanceKm: number | null | undefined;
};

/**
 * Sort comparator. Different scores keep rank order.
 * When generic FOOD tie-break applies:
 * - exact finalScore ties: smaller actual distanceKm wins
 * - if distance is also equal: return 0 so the existing stable order is preserved
 */
export function compareGenericFoodTiedScores(
  a: FoodTieScoreFields,
  b: FoodTieScoreFields,
  query: string,
  parsed: ScenarioObject | null | undefined
): number {
  if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
  if (!isGenericFoodScoreTieBreakQuery(query, parsed)) return 0;

  const da = distanceKmForTie(a.distanceKm);
  const db = distanceKmForTie(b.distanceKm);
  if (da === db) return 0;
  return da - db;
}

function distanceKmForTie(distanceKm: number | null | undefined): number {
  if (typeof distanceKm === "number" && Number.isFinite(distanceKm)) return distanceKm;
  // Missing/invalid distance should never win over known distance.
  return Number.POSITIVE_INFINITY;
}

function normalizeIdentityPart(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Conservative real-world place key for recommendation-path dedupe.
 *
 * Strong identity evidence:
 * - normalized store name (exact after normalization)
 * - coordinates effectively identical (lat/lng rounded)
 * - address must be available and equal
 *
 * Returns null when identity is not strong enough.
 */
export function getConservativeRealWorldPlaceKeyForGenericFood(card: HomeCard): string | null {
  const name = normalizeIdentityPart(card.name ?? "");
  if (!name) return null;

  if (typeof card.lat !== "number" || typeof card.lng !== "number") return null;
  if (!Number.isFinite(card.lat) || !Number.isFinite(card.lng)) return null;

  const address = card.address;
  if (!address) return null;

  const addr = normalizeIdentityPart(address);
  return `realWorld|${name}|${addr}|${round6(card.lat)}|${round6(card.lng)}`;
}

/**
 * Collapse exact duplicate real-world places within each exact finalScore group.
 *
 * Assumptions:
 * - input is already sorted by finalScore DESC
 * - within the same finalScore, earlier items are preferred (e.g. by distance tie-break)
 */
export function collapseGenericFoodRealWorldDuplicatesWithinExactFinalScoreTies<
  T extends { card: HomeCard; breakdown: { finalScore: number } }
>(items: T[], getKey: (card: HomeCard) => string | null): T[] {
  if (items.length <= 1) return items;
  const out: T[] = [];
  let i = 0;
  while (i < items.length) {
    const fs = items[i]!.breakdown.finalScore;
    const seen = new Set<string>();
    while (i < items.length && items[i]!.breakdown.finalScore === fs) {
      const it = items[i]!;
      const key = getKey(it.card);
      if (key) {
        if (!seen.has(key)) {
          seen.add(key);
          out.push(it);
        }
      } else {
        out.push(it);
      }
      i += 1;
    }
  }
  return out;
}

export function compareScoredFoodTieOrder<
  T extends {
    card: { id: string; distanceKm?: number | null };
    breakdown: { finalScore: number };
  },
>(a: T, b: T, query: string, parsed: ScenarioObject | null | undefined): number {
  return compareGenericFoodTiedScores(
    {
      id: a.card.id,
      finalScore: a.breakdown.finalScore,
      distanceKm: a.card.distanceKm,
    },
    {
      id: b.card.id,
      finalScore: b.breakdown.finalScore,
      distanceKm: b.card.distanceKm,
    },
    query,
    parsed
  );
}
