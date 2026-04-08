import { SCENARIO_ALIAS_GROUPS } from "./scenarioAliases";
import {
  detectFoodSubCategory,
  detectMenuIntent,
  hasAnyFoodSubKeyword,
  inferFoodSubFromMenus,
} from "./foodIntent";
import { augmentScenarioWithComposite } from "./compositeIntent";

export { detectFoodSubCategory, detectMenuIntent } from "./foodIntent";
import type { IntentCategory, ScenarioObject, ScenarioType, UserIntentType } from "./types";
import type { HomeTabKey } from "@/lib/storeTypes";
import type { HomeCard } from "@/lib/storeTypes";
import { normIntentQuery } from "./intentQueryNormalize";
import { inferRecommendationMode } from "./recommendationMode";

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
 */
export function detectStrictCategory(rawQuery: string): IntentCategory | null {
  const q = normIntentQuery(rawQuery);
  if (!q) return null;

  const scores: Record<IntentCategory, number> = {
    FOOD: countHintHits(q, FOOD_HINTS),
    CAFE: countHintHits(q, CAFE_HINTS),
    ACTIVITY: countHintHits(q, ACTIVITY_HINTS),
    BEAUTY: countHintHits(q, BEAUTY_HINTS),
  };
  if (hasAnyFoodSubKeyword(q)) scores.FOOD += 3;
  if (BEAUTY_HAIR_CONTEXT.test(q)) scores.BEAUTY += 2;

  const max = Math.max(scores.FOOD, scores.CAFE, scores.ACTIVITY, scores.BEAUTY);
  if (max === 0) return null;

  const ties = (Object.entries(scores) as [IntentCategory, number][])
    .filter(([, s]) => s === max)
    .map(([c]) => c);

  if (ties.length === 1) return ties[0]!;

  if (ties.includes("CAFE") && /카페|커피|디저트|빵집|베이커리/.test(q)) return "CAFE";
  if (ties.includes("FOOD") && /점심|저녁|아침|브런치|맛집|식사|밥|먹|점메추|저메추|뭐\s*먹|뭐먹/.test(q))
    return "FOOD";
  if (ties.includes("BEAUTY")) return "BEAUTY";
  if (ties.includes("ACTIVITY")) return "ACTIVITY";

  return ties[0] ?? null;
}

type ScenarioDetect = { scenario: ScenarioType; confidence: number };

/**
 * 긴 구문을 먼저 매칭해 시나리오 충돌을 줄임.
 */
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
      const base = Math.min(0.95, 0.55 + phrase.length * 0.02);
      return { scenario, confidence: base };
    }
  }
  if (/(비 오는 날|비오는 날|장마|우산)/.test(q)) {
    return { scenario: "date", confidence: 0.45 };
  }
  if (
    /(조용한|한적)/.test(q) &&
    !q.includes("조용한 식사") &&
    !/(카페|커피|디저트|빵집)/.test(q)
  ) {
    return { scenario: "parents", confidence: 0.42 };
  }
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
  if (/(비 오는 날|비오는 날|장마)/.test(q)) {
    out.weatherHint = "rain";
    out.indoorPreferred = true;
  }
  if (/(눈 오는|첫눈)/.test(q)) {
    out.weatherHint = "snow";
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

  if (/(아이|애 |키즈|유아|초등|영유아)/.test(q)) out.withKids = true;
  if (/(부모님|어른)/.test(q)) out.withParents = true;

  if (/(식사|밥|먹고|맛집)/.test(q)) out.mealRequired = true;
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
  }
}

export function storeCategoryMatchesIntentCategory(
  card: HomeCard,
  cat: IntentCategory
): boolean {
  const c = String(card.category ?? "").toLowerCase();
  switch (cat) {
    case "FOOD":
      return c === "restaurant";
    case "CAFE":
      return c === "cafe";
    case "ACTIVITY":
      return c === "activity";
    case "BEAUTY":
      return c === "salon";
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

/**
 * 자연어 → ScenarioObject (의도 3분기 + 시나리오·제약 병합).
 */
export function parseScenarioIntent(rawQuery: string): ScenarioObject {
  const raw = String(rawQuery ?? "").trim();
  const q = normIntentQuery(raw);
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
  const menuIntent = detectMenuIntent(raw);

  if (menuIntent.length && !foodSub) {
    foodSub = inferFoodSubFromMenus(menuIntent) ?? foodSub;
  }

  if (foodSub && intentType === "search_strict" && !intentCategory) {
    intentCategory = "FOOD";
    intentStrict = true;
  }

  if (menuIntent.length && intentType === "search_strict" && !intentCategory) {
    intentCategory = "FOOD";
    intentStrict = true;
  }

  let obj: ScenarioObject = {
    intentType,
    recommendationMode: inferRecommendationMode(raw || q),
    intentCategory,
    intentStrict,
    scenario,
    confidence,
    rawQuery: raw || q,
  };

  if (foodSub && (obj.intentCategory === "FOOD" || intentType === "course_generation")) {
    obj.foodSubCategory = foodSub;
  }

  if (
    menuIntent.length &&
    (obj.intentCategory === "FOOD" || intentType === "course_generation")
  ) {
    obj.menuIntent = menuIntent;
  }

  obj = mergeScenarioObject(obj, modifierPartial);

  if (scenario === "family_kids" || scenario === "parent_child_outing") {
    obj.withKids = true;
  }
  if (scenario === "parents") {
    obj.withParents = true;
  }

  return augmentScenarioWithComposite(obj);
}

/** 복합 조건 파싱까지 포함한 동일 엔트리(의미상 parseScenarioIntent 와 동일) */
export function parseCompositeIntent(rawQuery: string): ScenarioObject {
  return parseScenarioIntent(rawQuery);
}
