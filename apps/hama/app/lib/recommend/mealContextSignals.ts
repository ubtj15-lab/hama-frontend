import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendScenarioKey } from "@/lib/recommend/scenarioWeights";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { inferServingTypeForRecommendation } from "@/lib/recommend/recommendationCopy";

/** 브런치·디저트·베이커리·키즈·가벼운 식사 신호가 있으면 drink-only 로 보지 않음 */
const CAFE_MEAL_OR_KIDS_BLOB =
  /브런치|디저트|베이커리|케이크|키즈|유아\s*동반|어린이|아이\s*메뉴|아이메뉴|아이와|식사|파스타|라면|샌드위치|샐러드|도시락|와플|팬케이크|토스트|빙수|덮밥|한끼|점심|정식|코스|샐러드바/i;

function cafeBlobForDrinkOnlyHeuristic(card: HomeCard): string {
  const c = card as any;
  return [
    c?.name,
    ...(card.tags ?? []),
    ...(card.mood ?? []),
    typeof c?.description === "string" ? c.description : "",
    ...(card.menu_keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * drink-only 일반 카페(메가커피·스타벅스 등): category cafe 이고
 * 브런치/디저트/베이커리/키즈·식사형 태그가 없을 때.
 */
export function isDrinkOnlyCafeForMealContext(card: HomeCard): boolean {
  if (String(card.category ?? "").toLowerCase() !== "cafe") return false;
  if (CAFE_MEAL_OR_KIDS_BLOB.test(cafeBlobForDrinkOnlyHeuristic(card))) return false;
  return true;
}

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
  if (so.scenario === "family_kids" || so.scenario === "parent_child_outing") return true;
  if (so.mealRequired === true) return true;
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

/** infer 기반(코스·카피 등 레거시) — CAFE 는 대부분 drink 로 잡히므로 랭킹 제외에는 {@link isDrinkOnlyCafeForMealContext} 사용 */
export function isDrinkOnlyCafeCard(card: HomeCard): boolean {
  const cat = String(card.category ?? "").toLowerCase();
  if (cat !== "cafe") return false;
  return inferServingTypeForRecommendation(card) === "drink";
}

/** 랭킹에서 drink-only 일반 카페를 제외할지(가족·아이 시나리오는 식사 맥락 없이도 항상 제외) */
export function shouldExcludeDrinkOnlyForScenarioRanking(
  rankKey: RecommendScenarioKey,
  scenarioObject: ScenarioObject | null | undefined,
  searchQuery: string | null | undefined
): boolean {
  const sc = scenarioObject?.scenario;
  if (
    rankKey === "family" &&
    sc &&
    (sc === "family_kids" || sc === "parent_child_outing" || sc === "family")
  ) {
    return true;
  }
  if (!impliesMealServingContext({ searchQuery, scenarioObject })) return false;
  if (rankKey === "family") return true;
  if (rankKey === "solo") {
    if (scenarioObject?.mealRequired === true) return true;
    return impliesMealServingContext({ searchQuery, scenarioObject });
  }
  if (rankKey === "date" && /점심|저녁|식사|한끼|밥|브런치|외식|맛집/.test((searchQuery ?? "").toLowerCase())) {
    return true;
  }
  return false;
}
