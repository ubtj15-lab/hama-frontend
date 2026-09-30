import { SCENARIO_ALIAS_GROUPS } from "./scenarioAliases";
import {
  detectFoodSubCategory,
  detectMenuIntent,
  hasAnyFoodSubKeyword,
  inferFoodSubFromMenus,
} from "./foodIntent";
import { augmentScenarioWithComposite } from "./compositeIntent";
import { inferDateTimeBandFromQuery } from "./dateCourseContext";
import { inferChildAgeGroupFromQuery } from "./familyCourseContext";
import {
  understandQuery,
  queryUnderstandingToIntentCategories,
} from "./queryUnderstanding";
import { applyNegationToScenarioObject, parseQueryNegation } from "./negationUnderstanding";
import {
  getCatalogMenuLexicon,
  matchCatalogMenusInQuery,
  resolveCatalogMenus,
} from "@/lib/recommend/catalogMenuLexicon";

export { detectFoodSubCategory, detectMenuIntent } from "./foodIntent";
import type { IntentCategory, ScenarioObject, ScenarioType, UserIntentType } from "./types";
import type { BeautySubCategory } from "./types";
import type { HomeTabKey } from "@/lib/storeTypes";
import type { HomeCard } from "@/lib/storeTypes";
import { normIntentQuery } from "./intentQueryNormalize";
import { inferRecommendationMode } from "./recommendationMode";
import {
  diningOutBareHintHits,
  hasStrongerDiningOutOverrideContext,
  isNeutralGenericDiningOutQuery,
} from "./genericDiningOut";
import { isExplicitDateMealTimeOnlyFoodLeak } from "./dateMealTimePrecedence";
import { classifyDiscoveryQuery } from "@/lib/recommend/discoveryRole";
import { detectConversationalDiscovery } from "@/lib/recommend/conversationalDiscovery";

export { normIntentQuery } from "./intentQueryNormalize";
export { explainCourseGenerationMatch, isCourseGenerationQuery } from "./courseTriggerPatterns";

/**
 * 1) recommendationMode === course → course_generation 2) search_strict 3) scenario_recommendation
 */
export function classifyIntent(q: string): UserIntentType {
  const n = normIntentQuery(q);
  if (!n) return "scenario_recommendation";
  if (inferRecommendationMode(q) === "course") return "course_generation";
  if (detectStrictCategory(n)) return "search_strict";
  return "scenario_recommendation";
}

const FOOD_HINTS = [
  "밥",
  "먹",
  "식사",
  "식당",
  "레스토랑",
  "점심",
  "저녁",
  "아침",
  "브런치",
  "점메추",
  "저메추",
  "맛집",
  "뭐 먹",
  "뭐먹",
  "먹지",
  "밥집",
  "외식",
  "회식",
];

const CAFE_HINTS = ["카페", "커피", "디저트", "빵집", "베이커리"];

const BEAUTY_HINTS = [
  "미용실",
  "헤어",
  "염색",
  "펌",
  "네일",
  "피부관리",
  "미용",
];

function detectBeautySubCategory(rawQuery: string): BeautySubCategory | null {
  const q = normIntentQuery(rawQuery);
  if (!q) return null;
  if (/(속눈썹|래쉬|lash|eyelash)/.test(q)) return "eyelash";
  if (/(제모|왁싱|waxing|왁스)/.test(q)) return "waxing";
  if (/(네일|네일아트|nail)/.test(q)) return "nail";
  if (/(헤어|미용실|커트|컷|펌|염색|hair)/.test(q)) return "hair";
  return null;
}

/** '머리' 단독은 오탐이 많아 미용/헤어 맥락과 함께만 인정 */
const BEAUTY_HAIR_CONTEXT = /머리\s*(짜르|자르|깎|잘라|해줘|예약|잘)/;

const ACTIVITY_HINTS = [
  "놀거리",
  "할거",
  "놀 곳",
  "놀만한 곳",
  "놀만한",
  "체험",
  "액티비티",
  "놀고",
  "전시",
  "도서관",
  "박물관",
  "미술관",
  "관람",
];

function countHintHits(q: string, hints: string[]): number {
  let n = 0;
  for (const h of hints) {
    if (q.includes(h)) n += 1;
  }
  return n;
}

/**
 * 단일 목적 카테고리(없으면 null → 멀티 카테고리 시나리오 추천).
 * 강한 구문 신호(understandQuery)가 있으면 hint-count보다 우선한다.
 */
export function detectStrictCategory(rawQuery: string): IntentCategory | null {
  const q = normIntentQuery(rawQuery);
  if (!q) return null;

  if (isNeutralGenericDiningOutQuery(rawQuery)) return "FOOD";
  if (isExplicitDateMealTimeOnlyFoodLeak(q)) return null;

  const understood = understandQuery(rawQuery);
  const neg = understood.negation ?? parseQueryNegation(rawQuery);
  const qHints = neg.isNegationQuery ? normIntentQuery(neg.positiveRemainder || q) : q;
  const foodHintsBesidesDiningOut =
    /밥|먹|식사|식당|레스토랑|점심|저녁|아침|브런치|점메추|저메추|맛집|뭐\s*먹|뭐먹|먹지|밥집/.test(qHints);

  if (understood.strongVertical && understood.route && understood.route !== "MIXED") {
    const diningOutOnlyFood =
      understood.route === "FOOD" &&
      hasStrongerDiningOutOverrideContext(rawQuery) &&
      !foodHintsBesidesDiningOut;
    if (!diningOutOnlyFood) return understood.route;
  }

  const scores: Record<IntentCategory, number> = {
    FOOD: countHintHits(qHints, FOOD_HINTS),
    CAFE: countHintHits(qHints, CAFE_HINTS),
    ACTIVITY: countHintHits(qHints, ACTIVITY_HINTS),
    BEAUTY: countHintHits(qHints, BEAUTY_HINTS),
    FITNESS: countHintHits(qHints, [
      "헬스",
      "gym",
      "필라테스",
      "요가",
      "수영",
      "클라이밍",
      "운동",
      "체육",
      "pt",
      "풋살",
      "축구",
      "배드민턴",
      "피트니스",
      "골프",
      "복싱",
      "태권도",
      "체육관",
      "체육센터",
    ]),
    LIFE: countHintHits(qHints, [
      "병원",
      "약국",
      "세탁",
      "편의점",
      "마트",
      "은행",
      "우체국",
      "생활",
      "의원",
      "치과",
      "종합병원",
      "드럭스토어",
    ]),
  };
  if (hasAnyFoodSubKeyword(qHints) && !/카페|커피|디저트|베이커리|빵집/.test(qHints)) scores.FOOD += 3;
  if (BEAUTY_HAIR_CONTEXT.test(qHints)) scores.BEAUTY += 2;
  if (/키즈\s*카페|키즈카페|놀이카페/.test(qHints) && !neg.excludedVenues.includes("kids_cafe")) {
    scores.ACTIVITY += 5;
    scores.CAFE = Math.max(0, scores.CAFE - 3);
  }
  if (neg.excludedCategories.includes("cafe")) scores.CAFE = 0;
  if (neg.excludedCategories.includes("restaurant") || neg.suppressedIntents.includes("MEAL")) scores.FOOD = 0;
  if (hasStrongerDiningOutOverrideContext(rawQuery)) {
    scores.FOOD = Math.max(0, scores.FOOD - diningOutBareHintHits(qHints));
  }

  const max = Math.max(scores.FOOD, scores.CAFE, scores.ACTIVITY, scores.BEAUTY, scores.FITNESS, scores.LIFE);
  if (max === 0) return null;

  const ties = (Object.entries(scores) as [IntentCategory, number][])
    .filter(([, s]) => s === max)
    .map(([c]) => c);

  if (ties.length === 1) return ties[0]!;

  if (ties.includes("CAFE") && /카페|커피|디저트|빵집|베이커리/.test(qHints) && !/키즈\s*카페|키즈카페/.test(qHints)) {
    return "CAFE";
  }
  if (ties.includes("ACTIVITY") && /전시|도서관|박물관|미술관|관람|키즈카페/.test(qHints)) return "ACTIVITY";
  if (ties.includes("FOOD") && /점심|저녁|아침|맛집|식사|식당|레스토랑|밥|먹|점메추|저메추|뭐\s*먹|뭐먹|회식|외식/.test(qHints))
    return "FOOD";
  if (ties.includes("BEAUTY")) return "BEAUTY";
  if (ties.includes("FITNESS")) return "FITNESS";
  if (ties.includes("LIFE")) return "LIFE";
  if (ties.includes("ACTIVITY")) return "ACTIVITY";

  return ties[0] ?? null;
}

type ScenarioDetect = { scenario: ScenarioType; confidence: number };

/**
 * 긴 구문을 먼저 매칭해 시나리오 충돌을 줄임.
 */
function hasExplicitChildCompanion(q: string): boolean {
  return /아이(?!스)|애들|키즈|유아|초등|(?<![0-9])(?:[1-9]|1[0-2])\s*살|(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열한|열두|열)\s*살/.test(q);
}

export function detectScenario(rawQuery: string): ScenarioDetect {
  const q = normIntentQuery(rawQuery);
  const pairs: { scenario: ScenarioType; phrase: string }[] = [];
  for (const g of SCENARIO_ALIAS_GROUPS) {
    for (const ph of g.phrases) {
      pairs.push({ scenario: g.scenario, phrase: ph });
    }
  }
  pairs.sort((a, b) => b.phrase.length - a.phrase.length);

  for (const { scenario, phrase } of pairs) {
    if (q.includes(phrase.toLowerCase())) {
      const base = Math.min(0.95, 0.52 + Math.min(phrase.length, 18) * 0.022);
      return { scenario, confidence: base };
    }
  }
  if (hasExplicitChildCompanion(q)) {
    return { scenario: "family_kids", confidence: 0.6 };
  }
  if (/(비 오는 날|비오는 날|장마|우산)/.test(q)) {
    if (/(아이|애들|키즈|유아|초등|가족|놀)/.test(q)) {
      return { scenario: "family_kids", confidence: 0.62 };
    }
    return { scenario: "date", confidence: 0.45 };
  }
  /** '조용한'만으로는 부모 동행(parents)으로 보지 않음 — 무드는 detectMoodAndConstraints */
  return { scenario: "generic", confidence: 0.25 };
}

/**
 * 실내·날씨·무드·시간대·예산 등 (ScenarioObject partial 필드).
 */
export function detectMoodAndConstraints(rawQuery: string): Partial<ScenarioObject> {
  const q = normIntentQuery(rawQuery);
  const out: Partial<ScenarioObject> = {};
  if (/(실내|인도어)/.test(q)) {
    out.indoorPreferred = true;
    out.mood = [...(out.mood ?? []), "indoor"];
  }
  if (/(비 오는 날|비오는 날|장마|우산|소나기)/.test(q)) {
    out.weatherHint = "rain";
    out.weatherCondition = "rainy";
    out.indoorPreferred = true;
  }
  if (/(눈 오는|첫눈)/.test(q)) {
    out.weatherHint = "snow";
    out.weatherCondition = "cold";
    out.indoorPreferred = true;
  }
  if (/(폭염|무더위|더운\s*날|너무\s*더|한여름\s*한낮)/.test(q)) {
    out.weatherCondition = "hot";
    out.indoorPreferred = true;
  }
  if (/(한파|추운\s*날|너무\s*추|영하)/.test(q)) {
    out.weatherCondition = "cold";
    out.indoorPreferred = true;
  }
  if (/(미세먼지|초미세|대기\s*질|공기\s*안\s*좋)/.test(q)) {
    out.weatherCondition = "bad_air";
    out.indoorPreferred = true;
  }
  if (/(조용한|한적|잔잔)/.test(q)) {
    out.mood = [...(out.mood ?? []), "calm"];
    out.activityLevel = out.activityLevel ?? "calm";
  }
  if (/(활동적|액티브|뛰어놀)/.test(q)) {
    out.activityLevel = "active";
  }
  if (/가볍게/.test(q)) {
    out.activityLevel = out.activityLevel ?? "mixed";
  }
  if (/(아침|브런치)/.test(q)) out.timeOfDay = "morning";
  if (/(점심|런치)/.test(q)) out.timeOfDay = "lunch";
  if (/(오후|한티타임)/.test(q)) out.timeOfDay = "afternoon";
  if (/(저녁|디너)/.test(q)) out.timeOfDay = "dinner";
  if (/(밤|야식|심야)/.test(q)) out.timeOfDay = "night";

  if (/(저렴|가성비|착한 가격)/.test(q)) out.budgetLevel = "low";
  if (/(고급|프리미엄|코스요리)/.test(q)) out.budgetLevel = "high";
  if (/(분위기 있는|감성)/.test(q) && !out.budgetLevel) out.budgetLevel = "medium";

  if (hasExplicitChildCompanion(q)) out.withKids = true;
  if (/(부모님|어른)/.test(q)) out.withParents = true;

  if (/(주차\s*되|주차되|주차\s*편한|주차\s*가능|주차)/.test(q) && !/(주차장만|주차타워)/.test(q)) {
    out.parkingPreferred = true;
  }

  if (/(식사|밥|먹고|맛집|외식|회식)/.test(q) && !parseQueryNegation(rawQuery).suppressedIntents.includes("MEAL")) {
    out.mealRequired = true;
  }
  return out;
}

export function intentCategoryToHomeTab(cat: IntentCategory): HomeTabKey {
  switch (cat) {
    case "FOOD":
      return "restaurant";
    case "CAFE":
      return "cafe";
    case "ACTIVITY":
      return "activity";
    case "BEAUTY":
      return "salon";
    case "FITNESS":
      return "fitness";
    case "LIFE":
      return "life";
  }
}

function homeCardBlobLower(card: HomeCard): string {
  const tags = Array.isArray(card.tags) ? card.tags.join(" ") : String(card.tags ?? "");
  return `${card.name ?? ""} ${tags} ${String(card.categoryLabel ?? "")}`.toLowerCase();
}

function blobMatchesFitnessStore(card: HomeCard): boolean {
  const b = homeCardBlobLower(card);
  if (/(보드게임|boardgame|방탈출|키즈카페|키즈\s*카페|놀이카페)/.test(b)) return false;
  if (
    /(음식점|맛집|레스토랑|브런치|베이커리|한식|중식|일식|카페|coffee)/.test(b) &&
    !/(헬스|gym|체육|수영|\bpt\b|요가|필라테스|클라이밍)/.test(b)
  ) {
    return false;
  }
  return /(헬스|피트니스|fitness|\bpt\b|퍼스널트레이닝|필라테스|요가|클라이밍|수영|체육관|체육센터|운동|복싱|태권도|골프|풋살|축구|배드민턴|gym|pilates|yoga|swimming)/i.test(
    b
  );
}

function blobMatchesLifeStore(card: HomeCard): boolean {
  const b = homeCardBlobLower(card);
  return /(동물병원|수의과|병원|종합병원|의원|치과|내과|소아과|약국|드럭스토어|세탁|크리닝|laundry|편의점|마트|슈퍼마켓|이마트|롯데마트|홈플러스|코스트코|생활편의|공공시설|주차장|주차|은행|우체국|수리|에이에스|생활서비스|편의서비스)/.test(
    b
  );
}

export function storeCategoryMatchesIntentCategory(
  card: HomeCard,
  cat: IntentCategory
): boolean {
  const c = String(card.category ?? "").toLowerCase();
  switch (cat) {
    case "FOOD":
      return c === "restaurant" || c === "fd6" || c.includes("restaurant") || c.includes("food");
    case "CAFE":
      return c === "cafe" || c === "ce7" || c.includes("cafe") || c.includes("coffee");
    case "ACTIVITY":
      return c === "activity" || c === "at4" || c.includes("activity");
    case "BEAUTY":
      return c === "salon" || c === "bk9" || c === "beauty" || c.includes("salon") || c.includes("beauty");
    case "FITNESS": {
      if (c.includes("fitness") || c.includes("gym")) return true;
      if (c === "activity" || c === "at4" || c.includes("activity")) return blobMatchesFitnessStore(card);
      return blobMatchesFitnessStore(card);
    }
    case "LIFE":
      return blobMatchesLifeStore(card);
    default:
      return false;
  }
}

function mergeScenarioObject(
  base: ScenarioObject,
  partial: Partial<ScenarioObject>
): ScenarioObject {
  const mood = [...new Set([...(base.mood ?? []), ...(partial.mood ?? [])])];
  return {
    ...base,
    ...partial,
    ...(mood.length ? { mood } : {}),
  };
}

/** 가족/아이 시나리오는 명시적 키워드가 있을 때만 유지 (모호한 문장의 family 오분류 방지) */
function explicitFamilyKeywordsInQuery(q: string): boolean {
  return /(아이랑|아이들이|아이들|애들|아이\s|아이와|가족|부모님|부모와|유아|영유아|초등|애\s*데리고|가족\s*외식|가족끼리|가족이랑|키즈\s*나들이|키즈\s*메뉴|유아\s*동반|나들이\s*갈|(?<![0-9])(?:[1-9]|1[0-2])\s*살|(?:일곱|여섯|다섯|여덟|아홉|열)\s*살)/.test(
    q
  );
}

/**
 * alias 매칭만으로 family로 붙은 경우, 쿼리에 가족/아이 근거가 없으면 generic 으로 되돌림.
 * 편한/넓은/무난한 등은 여기서 family로 승격되지 않음.
 */
export function resolveAmbiguousScenario(obj: ScenarioObject): ScenarioObject {
  const q = normIntentQuery(obj.rawQuery ?? "");
  const fam: ScenarioType[] = ["family", "family_kids", "parent_child_outing"];
  let next: ScenarioObject = { ...obj };

  if (fam.includes(next.scenario) && !explicitFamilyKeywordsInQuery(q)) {
    const keepKidsFlag = /(아이|키즈|유아|영유아|초등|가족)/.test(q);
    next = {
      ...next,
      scenario: "generic",
      confidence: Math.min(next.confidence ?? 0.28, 0.32),
      withKids: keepKidsFlag ? next.withKids : false,
    };
  }

  if (next.scenario === "parents" && !/(부모님|부모|어머니|아버지|어른)/.test(q)) {
    next = { ...next, scenario: "generic", confidence: Math.min(next.confidence ?? 0.28, 0.3), withParents: false };
  }

  return next;
}

/**
 * 자연어 → ScenarioObject (의도 3분기 + 시나리오·제약 병합).
 */
export function parseScenarioIntent(rawQuery: string): ScenarioObject {
  const raw = String(rawQuery ?? "").trim();
  const q = normIntentQuery(raw);
  const understood = understandQuery(raw || q);
  const intentType = classifyIntent(q);
  const { scenario, confidence } = detectScenario(q);
  const modifierPartial = detectMoodAndConstraints(q);

  let intentCategory: IntentCategory | undefined;
  let intentStrict: boolean | undefined;

  if (intentType === "search_strict") {
    intentCategory = detectStrictCategory(q) ?? undefined;
    intentStrict = intentCategory ? true : undefined;
  }

  let foodSub = detectFoodSubCategory(q);
  let beautySub = detectBeautySubCategory(q);
  const menuIntent = [...new Set([...(understood.menuIntents ?? []), ...detectMenuIntent(raw)])];

  if (menuIntent.length && !foodSub) {
    foodSub = inferFoodSubFromMenus(menuIntent) ?? foodSub;
  }

  const diningOutOnlyUnderStrongerContext =
    hasStrongerDiningOutOverrideContext(raw || q) &&
    !isNeutralGenericDiningOutQuery(raw || q) &&
    !/밥|먹|식사|식당|레스토랑|점심|저녁|아침|브런치|점메추|저메추|맛집|뭐\s*먹|뭐먹|먹지|밥집/.test(q);
  const dateMealTimeOnlyLeak = isExplicitDateMealTimeOnlyFoodLeak(q);

  // 브런치/디저트는 CAFE 우선 — foodSub WESTERN이 FOOD로 덮지 않게
  if (
    intentType !== "course_generation" &&
    !dateMealTimeOnlyLeak &&
    understood.strongVertical &&
    understood.route &&
    understood.route !== "MIXED" &&
    !(understood.route === "FOOD" && diningOutOnlyUnderStrongerContext)
  ) {
    intentCategory = understood.route;
    intentStrict = true;
  }

  if (foodSub && intentType === "search_strict" && !intentCategory) {
    intentCategory = "FOOD";
    intentStrict = true;
  }

  if (menuIntent.length && intentType === "search_strict" && !intentCategory) {
    intentCategory = "FOOD";
    intentStrict = true;
  }

  if (beautySub && intentType === "search_strict" && !intentCategory) {
    intentCategory = "BEAUTY";
    intentStrict = true;
  }

  const intentCategories = queryUnderstandingToIntentCategories(understood);

  let obj: ScenarioObject = {
    intentType: intentType === "course_generation"
      ? intentType
      : !dateMealTimeOnlyLeak &&
          understood.strongVertical &&
          !(understood.route === "FOOD" && diningOutOnlyUnderStrongerContext)
        ? "search_strict"
        : intentType,
    recommendationMode: inferRecommendationMode(raw || q),
    intentCategory,
    intentCategories: intentCategories.length ? intentCategories : undefined,
    intentStrict,
    scenario,
    confidence,
    rawQuery: raw || q,
    queryUnderstanding: understood,
  };

  if (understood.parkingPreferred) obj.parkingPreferred = true;

  if (foodSub && (obj.intentCategory === "FOOD" || intentType === "course_generation")) {
    obj.foodSubCategory = foodSub;
  }

  if (
    menuIntent.length &&
    (obj.intentCategory === "FOOD" ||
      obj.intentCategory === "CAFE" ||
      obj.intentCategory === "ACTIVITY" ||
      intentType === "course_generation")
  ) {
    obj.menuIntent = menuIntent;
  }

  if (beautySub && (obj.intentCategory === "BEAUTY" || intentType === "course_generation")) {
    obj.beautySubCategory = beautySub;
  }

  obj = mergeScenarioObject(obj, modifierPartial);

  if (scenario === "family_kids" || scenario === "parent_child_outing") {
    obj.withKids = true;
  }
  if (scenario === "parents") {
    obj.withParents = true;
  }
  if ((understood.companionIntents ?? []).includes("child")) {
    obj.withKids = true;
  }
  if ((understood.companionIntents ?? []).includes("group") && obj.scenario === "generic") {
    obj.scenario = "group";
  }

  obj = resolveAmbiguousScenario(obj);

  if (obj.scenario === "family_kids" || obj.scenario === "parent_child_outing") {
    obj.mealRequired = true;
  }

  const famScenarios: ScenarioType[] = ["family", "family_kids", "parent_child_outing"];
  if (famScenarios.includes(obj.scenario) && obj.childAgeGroup == null) {
    obj.childAgeGroup = inferChildAgeGroupFromQuery(raw || q);
  }

  if (obj.scenario === "date" && obj.dateTimeBand == null) {
    const band = inferDateTimeBandFromQuery(raw || q);
    if (band) obj.dateTimeBand = band;
  }

  obj = applyNegationToScenarioObject(augmentScenarioWithComposite(obj));
  return applyCatalogMenuLexiconToScenario(obj);
}

function applyCatalogMenuLexiconToScenario(obj: ScenarioObject): ScenarioObject {
  const lexicon = getCatalogMenuLexicon();
  const remainder =
    obj.queryUnderstanding?.negation?.isNegationQuery && obj.queryUnderstanding.negation.positiveRemainder
      ? obj.queryUnderstanding.negation.positiveRemainder
      : obj.rawQuery;
  const excludedMenus = [
    ...(obj.queryUnderstanding?.negation?.excludedMenus ?? []),
    ...(obj.conversationExcludeMenuTerms ?? []),
  ];
  const matches = matchCatalogMenusInQuery(remainder, lexicon);
  const resolution = resolveCatalogMenus({
    staticMenuIntent: obj.menuIntent ?? [],
    catalogMatches: matches,
    excludedMenus,
  });
  const staticMenus = obj.menuIntent ?? [];
  const discovery = classifyDiscoveryQuery(obj.rawQuery, obj);
  const next = { ...obj, catalogMenu: resolution };
  if (discovery.isDiscovery && !staticMenus.length && !resolution.catalogMenuPrimary) {
    const skipped = {
      ...obj,
      catalogMenu: {
        ...resolution,
        catalogMenuPrimary: null,
        catalogMenuSecondary: [],
        resolvedMenuIntent: staticMenus,
        collision: resolution.collision === "multiple_dynamic" ? "dynamic_vs_context" : resolution.collision,
      },
    };
    skipped.conversationalDiscovery = detectConversationalDiscovery(obj.rawQuery, skipped);
    return skipped;
  }
  if (resolution.resolvedMenuIntent.length) {
    next.menuIntent = resolution.resolvedMenuIntent;
  }
  const primaryKind = resolution.catalogMenuMatches[0]?.kind;
  if (
    resolution.catalogMenuPrimary &&
    !staticMenus.length &&
    primaryKind === "FOOD_MENU" &&
    next.intentCategory !== "CAFE" &&
    next.intentCategory !== "BEAUTY" &&
    next.intentCategory !== "ACTIVITY" &&
    next.intentType !== "course_generation"
  ) {
    next.intentCategory = "FOOD";
    next.intentType = "search_strict";
    next.intentStrict = true;
    if (next.queryUnderstanding) {
      next.queryUnderstanding = {
        ...next.queryUnderstanding,
        route: "FOOD",
        primaryCategory: "restaurant",
        strongVertical: true,
      };
    }
  }
  next.conversationalDiscovery = detectConversationalDiscovery(obj.rawQuery, next);
  return next;
}

/** 복합 조건 파싱까지 포함한 동일 엔트리(의미상 parseScenarioIntent 와 동일) */
export function parseCompositeIntent(rawQuery: string): ScenarioObject {
  return parseScenarioIntent(rawQuery);
}
