import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendScenarioKey } from "@/lib/recommend/scenarioWeights";

/** DB category 정규화 값 */
export type NormalizedCategory = "restaurant" | "cafe" | "salon" | "activity" | "unknown";

/**
 * 시나리오별 허용 업종(카테고리).
 * - date/family: 외식·카페·놀거리 (미용 제외)
 * - solo: 가볍게 식사·카페 중심
 * - group: 식사·단체 놀거리 (카페 제외)
 */
const SCENARIO_ALLOWED: Record<RecommendScenarioKey, ReadonlySet<NormalizedCategory>> = {
  date: new Set(["restaurant", "cafe", "activity"]),
  family: new Set(["restaurant", "cafe", "activity"]),
  solo: new Set(["restaurant", "cafe"]),
  group: new Set(["restaurant", "cafe", "activity"]),
};

/** neutral(시나리오 불명): 식음·액티비티 중심, 미용은 글로벌 제외로 걸러짐 */
const NEUTRAL_ALLOWED = new Set<NormalizedCategory>(["restaurant", "cafe", "activity"]);

/** 시나리오 추천에서 항상 제외(의료·금융·편의 등). 미용은 별도 처리. */
const HARD_NON_POI_PATTERNS: RegExp[] = [
  /병원|의원|치과|한의원|약국|클리닉|의료|건강검진|내과|외과|소아과/i,
  /은행|금융|ATM|증권|보험|캐피탈|저축은행|대출|대부/i,
  /부동산|공인중개|중개업소|매물/i,
  /편의점|gs25|cu\b|세븐일레븐|이마트24|미니스톱|지에스25/i,
  /안마|마사지|정비소|수리|세탁소/i,
];

const SALON_HINT_PATTERNS = /미용실|헤어|헤어샵|네일|살롱|뷰티|피부|왁싱|이발/i;

function blobForHeuristics(card: HomeCard): string {
  return [
    card.name,
    card.description,
    card.categoryLabel,
    ...(card.tags ?? []),
    ...(card.mood ?? []),
    ...(card.menu_keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** 의료·금융·편의 등 — 시나리오·검색 공통으로 제외 */
export function isHardExcludedNonPoi(card: HomeCard): boolean {
  const blob = blobForHeuristics(card);
  return HARD_NON_POI_PATTERNS.some((re) => re.test(blob));
}

function isSalonLike(card: HomeCard): boolean {
  const raw = String(card.category ?? "").toLowerCase().trim();
  if (raw === "salon") return true;
  return SALON_HINT_PATTERNS.test(blobForHeuristics(card));
}

/**
 * 시나리오 추천용: 미용실(salon) + 비대상 POI 제외.
 * `search_strict` + BEAUTY 의도일 때는 미용 허용 → {@link isHardExcludedNonPoi} 만 쓸 것.
 */
export function isGloballyExcludedCategory(card: HomeCard): boolean {
  if (isHardExcludedNonPoi(card)) return true;
  return isSalonLike(card);
}

function inferCategoryFromBlob(card: HomeCard): NormalizedCategory {
  const b = blobForHeuristics(card);
  if (/카페|커피|디저트|베이커리|브런치|티\s*하우스/.test(b)) return "cafe";
  if (/식당|맛집|고깃|한식|양식|일식|중식|밥|요리|주점|포차|이자카야|레스토랑|restaurant|맥주|술집/.test(b))
    return "restaurant";
  if (/키즈|전시|영화|골프|체험|놀이|테마|공원|볼링|방탈|escape|놀거리|액티비티/.test(b)) return "activity";
  if (/미용|헤어|네일|살롱|피부|왁싱/.test(b)) return "salon";
  return "unknown";
}

/** 카드의 업종 키 (DB category 우선, 없으면 휴리스틱) */
export function normalizeCategory(card: HomeCard): NormalizedCategory {
  const raw = String(card.category ?? "").toLowerCase().trim();
  if (raw === "restaurant" || raw === "cafe" || raw === "salon" || raw === "activity") {
    return raw;
  }
  return inferCategoryFromBlob(card);
}

/**
 * strict 필터: 시나리오 허용 목록 + 글로벌 제외.
 * unknown이면 제외(데이터 부족 시 relaxed 패스에서만 살릴 수 있음).
 */
export function isCategoryAllowedForScenarioStrict(
  card: HomeCard,
  rankKey: RecommendScenarioKey | "neutral"
): boolean {
  if (isGloballyExcludedCategory(card)) return false;
  const cat = normalizeCategory(card);
  if (cat === "unknown" || cat === "salon") return false;
  if (rankKey === "neutral") return NEUTRAL_ALLOWED.has(cat);
  return SCENARIO_ALLOWED[rankKey].has(cat);
}

/**
 * relaxed 후보: 비정상 POI 제외. `allowSalon`(명시 미용 검색)이면 살롱 허용.
 */
export function isCategoryAllowedRelaxed(card: HomeCard, allowSalon = false): boolean {
  if (isHardExcludedNonPoi(card)) return false;
  if (!allowSalon && isSalonLike(card)) return false;
  return true;
}

/** 최종 덱에서 ‘시나리오 적합’으로 칠 카드 — strict 규칙과 동일 */
export function isPreferredScenarioCategory(
  card: HomeCard,
  rankKey: RecommendScenarioKey | "neutral"
): boolean {
  return isCategoryAllowedForScenarioStrict(card, rankKey);
}
