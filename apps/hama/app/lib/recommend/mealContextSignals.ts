import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendScenarioKey } from "@/lib/recommend/scenarioWeights";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { inferServingTypeForRecommendation } from "@/lib/recommend/recommendationCopy";

/**
 * 식사·한 끼 의도가 있을 때 drink-only 카페를 추천 풀에서 제외(strict)하기 위한 신호.
 */
export function impliesMealServingContext(args: {
  searchQuery?: string | null;
  scenarioObject?: ScenarioObject | null;
}): boolean {
  const q = (args.searchQuery ?? "").toLowerCase();
  if (
    /혼밥|점심|저녁|식사|한끼|밥|브런치|런치|국밥|덮밥|빠른\s*식사|한\s*끼|외식|맛집|식당|뜯어|한식|양식|일식|중식/.test(q)
  ) {
    return true;
  }
  const so = args.scenarioObject;
  if (!so) return false;
  if (so.timeOfDay === "lunch" || so.timeOfDay === "dinner" || so.timeOfDay === "brunch") return true;
  if ((so.menuIntent?.length ?? 0) > 0) return true;
  if (so.intentCategory === "FOOD" && so.intentType === "search_strict") return true;
  if (
    (so.scenario === "family" || so.scenario === "family_kids" || so.scenario === "parent_child_outing") &&
    /식사|외식|맛집|식당|한끼/.test(q)
  ) {
    return true;
  }
  return false;
}

export function isDrinkOnlyCafeCard(card: HomeCard): boolean {
  const cat = String(card.category ?? "").toLowerCase();
  if (cat !== "cafe") return false;
  return inferServingTypeForRecommendation(card) === "drink";
}

/** strict 랭킹에서 drink-only 카페를 빼도 되는지(식사 맥락 + 시나리오) */
export function shouldExcludeDrinkOnlyForScenarioRanking(
  rankKey: RecommendScenarioKey,
  scenarioObject: ScenarioObject | null | undefined,
  searchQuery: string | null | undefined
): boolean {
  if (!impliesMealServingContext({ searchQuery, scenarioObject })) return false;
  if (rankKey === "solo" || rankKey === "family") return true;
  if (rankKey === "date" && /점심|저녁|식사|한끼|밥|브런치|외식|맛집/.test((searchQuery ?? "").toLowerCase())) {
    return true;
  }
  return false;
}
