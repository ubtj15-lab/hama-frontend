import type { HomeCard } from "@/lib/storeTypes";
import type { CourseServingType, PlaceType, ScenarioObject } from "./types";
import { mapPlaceToPlaceType } from "./placeTypeMap";

const DRINK_HINT = /(?:^|\s)(커피|음료|차\b|티\b|베이커리|디저트|케이크|브런치\s*만)/i;
const LIGHT_HINT = /(?:브런치|샐러드|샌드위치|라이트|가벼운|간단)/i;
const MEAL_HINT = /(?:한식|중식|일식|양식|고기|회식|코스|정식|식사|점심|저녁|저녁식사)/i;

/**
 * 카드에서 meal / light / drink 추론.
 * - 코스에서 식사 단계(FOOD)는 drink-only를 제외.
 */
export function inferFoodServingType(card: HomeCard): CourseServingType {
  const hay = `${card.name ?? ""} ${(card.tags ?? []).join(" ")} ${(card.mood ?? []).join(" ")} ${(card as any).description ?? ""}`;
  if (DRINK_HINT.test(hay) && !MEAL_HINT.test(hay) && !LIGHT_HINT.test(hay)) return "drink";
  if (LIGHT_HINT.test(hay)) return "light";
  return "meal";
}

export function inferServingTypeForPlace(card: HomeCard, placeType: PlaceType): CourseServingType {
  if (placeType === "FOOD") return inferFoodServingType(card);
  if (placeType === "CAFE") {
    const hay = `${card.name ?? ""} ${(card.tags ?? []).join(" ")}`;
    if (MEAL_HINT.test(hay) && /브런치|파스타|라면/.test(hay)) return "light";
    return "drink";
  }
  return "light";
}

/** 식사 단계에서 drink-only 제외 여부 */
export function isDrinkOnlyForMealStep(card: HomeCard, expectedStep: PlaceType): boolean {
  if (expectedStep !== "FOOD") return false;
  return inferFoodServingType(card) === "drink";
}

/** 혼밥 등 식사 요청 시 drink-only 강한 감점용 */
export function isDrinkOnlyCafeAsFood(card: HomeCard): boolean {
  const pt = mapPlaceToPlaceType(card);
  if (pt !== "CAFE") return false;
  return inferServingTypeForPlace(card, "CAFE") === "drink" && !MEAL_HINT.test(`${card.name ?? ""}`);
}

export function servingOkForStep(
  card: HomeCard,
  stepType: PlaceType,
  obj: ScenarioObject,
  mealRequired: boolean
): boolean {
  if (stepType !== "FOOD") return true;
  if (isDrinkOnlyForMealStep(card, stepType)) return false;
  if (mealRequired && obj.scenario === "solo" && inferFoodServingType(card) === "drink") return false;
  return true;
}
