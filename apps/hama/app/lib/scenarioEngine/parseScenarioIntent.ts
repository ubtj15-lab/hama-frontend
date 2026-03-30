import { COURSE_INTENT_MARKERS, SCENARIO_ALIAS_GROUPS } from "./scenarioAliases";
import type { ScenarioObject, ScenarioType, UserIntentType } from "./types";

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function detectIntentType(q: string): UserIntentType {
  for (const m of COURSE_INTENT_MARKERS) {
    if (q.includes(m)) return "course_generation";
  }
  return "place_recommendation";
}

function pickScenario(q: string): { scenario: ScenarioType; confidence: number } {
  for (const { scenario, phrases } of SCENARIO_ALIAS_GROUPS) {
    for (const ph of phrases) {
      if (q.includes(ph.toLowerCase())) {
        const base = Math.min(0.95, 0.55 + ph.length * 0.02);
        return { scenario, confidence: base };
      }
    }
  }
  if (/(비 오는 날|비오는 날|장마|우산)/.test(q)) {
    return { scenario: "date", confidence: 0.45 };
  }
  if (/(조용한|한적)/.test(q)) {
    return { scenario: "parents", confidence: 0.42 };
  }
  return { scenario: "generic", confidence: 0.25 };
}

function applyModifiers(q: string, base: ScenarioObject): ScenarioObject {
  const o = { ...base };
  if (/(실내|인도어)/.test(q)) {
    o.indoorPreferred = true;
    o.mood = [...(o.mood ?? []), "indoor"];
  }
  if (/(비 오는 날|비오는 날|장마)/.test(q)) {
    o.weatherHint = "rain";
    o.indoorPreferred = true;
  }
  if (/(눈 오는|첫눈)/.test(q)) {
    o.weatherHint = "snow";
    o.indoorPreferred = true;
  }
  if (/(조용한|한적|잔잔)/.test(q)) {
    o.mood = [...(o.mood ?? []), "calm"];
    o.activityLevel = o.activityLevel ?? "calm";
  }
  if (/(활동적|액티브|뛰어놀)/.test(q)) {
    o.activityLevel = "active";
  }
  if (/(가볍게|가볍게)/.test(q)) {
    o.activityLevel = o.activityLevel ?? "mixed";
  }
  if (/(아침|브런치)/.test(q)) o.timeOfDay = "morning";
  if (/(점심|런치)/.test(q)) o.timeOfDay = "lunch";
  if (/(오후|한티타임)/.test(q)) o.timeOfDay = "afternoon";
  if (/(저녁|디너)/.test(q)) o.timeOfDay = "dinner";
  if (/(밤|야식|심야)/.test(q)) o.timeOfDay = "night";

  if (/(저렴|가성비|착한 가격)/.test(q)) o.budgetLevel = "low";
  if (/(고급|프리미엄|코스요리)/.test(q)) o.budgetLevel = "high";
  if (/(분위기 있는|감성)/.test(q) && !o.budgetLevel) o.budgetLevel = "medium";

  if (/(아이|애 |키즈|유아|초등|영유아)/.test(q)) o.withKids = true;
  if (/(부모님|어른)/.test(q)) o.withParents = true;

  if (/(식사|밥|먹고|맛집)/.test(q)) o.mealRequired = true;
  return o;
}

/**
 * 자연어 → ScenarioObject 정규화
 *
 * 예시 (요약 출력):
 * - "데이트 코스 짜줘" → course_generation, date, 비/실내 보조 가능
 * - "아이랑 갈만한 곳 추천해줘" → place_recommendation, family_kids, withKids
 * - "부모님 모시고 조용한 식당" → parents, mood calm
 * - "비 오는 날 실내 데이트 코스" → course_generation, date, rain, indoorPreferred
 * - "친구들이랑 가볍게 놀만한 곳" → friends, activityLevel mixed
 * - "애 데리고 밥 먹기 좋은 곳" → family_kids, mealRequired
 * - "회식 맛집 코스" → course_generation, group
 * - "혼밥 빠른" → solo
 * - "가족 외식 추천" → family
 * - "아무거나" → generic, 낮은 confidence
 */
export function parseScenarioIntent(rawQuery: string): ScenarioObject {
  const raw = String(rawQuery ?? "").trim();
  const q = norm(raw);
  const intentType = detectIntentType(q);
  const { scenario, confidence } = pickScenario(q);

  let obj: ScenarioObject = {
    intentType,
    scenario,
    confidence,
    rawQuery: raw || q,
  };

  obj = applyModifiers(q, obj);

  if (scenario === "family_kids" || scenario === "parent_child_outing") {
    obj.withKids = true;
  }
  if (scenario === "parents") {
    obj.withParents = true;
  }

  return obj;
}
