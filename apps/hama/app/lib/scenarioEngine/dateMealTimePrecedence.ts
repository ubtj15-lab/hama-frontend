/**
 * Narrow DATE precedence: explicit DATE context must not become FOOD-strict
 * just because a meal-time word is present. Does not change FOOD_HINTS.
 */

const STRONG_DATE_CONTEXT_RE = /데이트|연인|커플|여자친구|남자친구/;
const MEAL_TIME_WORD_RE = /아침|점심|저녁|브런치/;
const GENUINE_MEAL_INTENT_RE =
  /밥|먹|식사|식당|맛집|외식|레스토랑|점메추|저메추|밥집|회식|뭐\s*먹|뭐먹|먹지/;

export function isExplicitDateMealTimeOnlyFoodLeak(normalizedQuery: string): boolean {
  const q = String(normalizedQuery ?? "");
  if (!q) return false;
  if (!STRONG_DATE_CONTEXT_RE.test(q)) return false;
  if (!MEAL_TIME_WORD_RE.test(q)) return false;
  if (GENUINE_MEAL_INTENT_RE.test(q)) return false;
  return true;
}
