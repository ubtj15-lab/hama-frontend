import { normalizeBrandQuery } from "@/lib/results/placeNameSearchIntent";

const FAMILY_DINING_ALIAS_QUERIES = new Set([
  "가족 외식",
  "가족외식",
  "가족 식사",
  "가족이랑 외식",
  "가족이랑 밥",
  "가족이랑 식사",
]);

const QUERY_ALIAS_EXPANSION: Record<string, string> = {
  문화생활: "박물관 전시 미술관 도서관 체험 문화",
  데이트: "카페 분위기 좋은 레스토랑 산책 디저트",
  "아이랑 갈만한 곳": "키즈카페 공원 도서관 체험 가족",
  "아이랑 밥": "가족 아이랑 식당 한식 분식",
  "비오는날 실내": "카페 도서관 박물관 실내 키즈카페",
  "조용한 카페": "카페 조용한 감성",
};

const RESULTS_SITUATION_PRESET_QUERIES = new Set([
  "문화생활",
  "데이트",
  "아이랑 갈만한 곳",
  "비오는날 실내",
]);

/** Analytics label for a scenario intent category. Unknown values pass through. */
export function intentCategoryToCategoryClicked(intentCategory: string | null | undefined): string | null {
  if (!intentCategory) return null;
  if (intentCategory === "FOOD") return "푸드";
  if (intentCategory === "CAFE") return "카페";
  if (intentCategory === "BEAUTY") return "미용실";
  if (intentCategory === "FITNESS") return "운동";
  if (intentCategory === "LIFE") return "생활";
  if (intentCategory === "ACTIVITY") return "액티비티";
  return intentCategory;
}

export function isFamilyDiningAliasQuery(qRaw: string, qNormalized: string): boolean {
  return FAMILY_DINING_ALIAS_QUERIES.has(qRaw.trim()) || FAMILY_DINING_ALIAS_QUERIES.has(qNormalized);
}

export function isGenericFoodResultsQuery(qNormalized: string): boolean {
  return qNormalized === "푸드" || qNormalized === "식당" || qNormalized === "맛집";
}

export function isSituationResultsQuery(qRaw: string): boolean {
  return RESULTS_SITUATION_PRESET_QUERIES.has(qRaw.trim());
}

/**
 * Query string passed into home-card ranking.
 * Situation presets stay literal. Other aliases expand. The current turn is the fallback.
 */
export function resolveSearchQueryForHomeCards(input: {
  qRaw: string;
  explicitCategory: string | null;
  isSoloSituationQuery: boolean;
  hasNamedFoodPreset: boolean;
}): string | null {
  const { qRaw } = input;
  const qTrim = qRaw.trim();
  if (input.isSoloSituationQuery) return qTrim || null;
  if (input.hasNamedFoodPreset) return qTrim || null;
  if (qTrim === "박물관") return qTrim;
  if (qTrim === "도서관") return qTrim;
  if (RESULTS_SITUATION_PRESET_QUERIES.has(qTrim)) return qTrim;
  if (QUERY_ALIAS_EXPANSION[qTrim]) return QUERY_ALIAS_EXPANSION[qTrim];
  if ((input.explicitCategory ?? "").trim().toLowerCase() === "culture") return qRaw || null;
  const qNorm = normalizeBrandQuery(qRaw).trim();
  if (FAMILY_DINING_ALIAS_QUERIES.has(qTrim) || FAMILY_DINING_ALIAS_QUERIES.has(qNorm)) return "식당";
  if (qNorm === "푸드") return "식당";
  if (qNorm === "식당" || qNorm === "맛집") return qNorm;
  return qRaw || null;
}
