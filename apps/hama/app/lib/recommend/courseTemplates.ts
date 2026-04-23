import type { CourseTemplate, ScenarioContext, ScenarioType, TimeOfDay, ChildAgeGroup } from "./courseTypes";

export type { CourseTemplate, ScenarioContext, ScenarioType } from "./courseTypes";

/** 기본 카탈로그 — 시나리오별로 `selectTemplates`에서 필터 */
export const COURSE_TEMPLATE_CATALOG: CourseTemplate[] = [
  // date
  {
    id: "date-food-cafe",
    scenarios: ["date"],
    steps: ["FOOD", "CAFE"],
    movementLevel: "low",
    indoorPreference: "mixed",
    vibeTags: ["대화", "분위기"],
    durationMinMinutes: 150,
    durationMaxMinutes: 240,
  },
  {
    id: "date-food-activity-cafe",
    scenarios: ["date"],
    steps: ["FOOD", "ACTIVITY", "CAFE"],
    movementLevel: "medium",
    indoorPreference: "mixed",
    vibeTags: ["코스", "체험"],
    durationMinMinutes: 200,
    durationMaxMinutes: 300,
  },
  {
    id: "date-cafe-walk",
    scenarios: ["date"],
    steps: ["CAFE", "WALK"],
    movementLevel: "medium",
    indoorPreference: "outdoor",
    vibeTags: ["산책", "브런치"],
    durationMinMinutes: 120,
    durationMaxMinutes: 200,
  },
  // family_kids
  {
    id: "kids-food-activity-cafe",
    scenarios: ["family_kids"],
    steps: ["FOOD", "ACTIVITY", "CAFE"],
    movementLevel: "medium",
    indoorPreference: "indoor",
    vibeTags: ["실내", "키즈"],
    durationMinMinutes: 180,
    durationMaxMinutes: 300,
  },
  {
    id: "kids-food-walk-cafe",
    scenarios: ["family_kids"],
    steps: ["FOOD", "WALK", "CAFE"],
    movementLevel: "high",
    indoorPreference: "outdoor",
    vibeTags: ["공원", "나들이"],
    durationMinMinutes: 180,
    durationMaxMinutes: 320,
  },
  {
    id: "kids-food-activity",
    scenarios: ["family_kids"],
    steps: ["FOOD", "ACTIVITY"],
    movementLevel: "medium",
    indoorPreference: "indoor",
    vibeTags: ["놀이", "실내"],
    durationMinMinutes: 150,
    durationMaxMinutes: 260,
  },
  // solo
  {
    id: "solo-food-cafe",
    scenarios: ["solo"],
    steps: ["FOOD", "CAFE"],
    movementLevel: "low",
    indoorPreference: "mixed",
    vibeTags: ["혼밥", "가성비"],
    durationMinMinutes: 90,
    durationMaxMinutes: 150,
  },
  {
    id: "solo-cafe",
    scenarios: ["solo"],
    steps: ["CAFE"],
    movementLevel: "low",
    indoorPreference: "mixed",
    vibeTags: ["가벼움"],
    durationMinMinutes: 45,
    durationMaxMinutes: 90,
  },
  // group
  {
    id: "group-food-cafe",
    scenarios: ["group"],
    steps: ["FOOD", "CAFE"],
    movementLevel: "low",
    indoorPreference: "mixed",
    vibeTags: ["회식", "단체"],
    durationMinMinutes: 180,
    durationMaxMinutes: 300,
  },
  {
    id: "group-food-activity",
    scenarios: ["group"],
    steps: ["FOOD", "ACTIVITY"],
    movementLevel: "medium",
    indoorPreference: "mixed",
    vibeTags: ["단체", "액티비티"],
    durationMinMinutes: 180,
    durationMaxMinutes: 280,
  },
];

function timeBand(t: TimeOfDay): "day" | "eve" | "night" {
  if (t === "morning" || t === "lunch" || t === "afternoon") return "day";
  if (t === "dinner") return "eve";
  return "night";
}

function ageBand(a: ChildAgeGroup | undefined): "toddler" | "older" | "none" {
  if (a === "toddler") return "toddler";
  if (a === "child") return "older";
  return "none";
}

/** 시간대·날씨·연령에 따른 가중치 (단순 랭킹) */
export function scoreTemplateForContext(t: CourseTemplate, ctx: ScenarioContext): number {
  let s = 50;
  const band = timeBand(ctx.timeOfDay);
  const rain = ctx.weather === "rainy" || ctx.weather === "cold";
  const ab = ageBand(ctx.childAgeGroup);

  if (ctx.scenario === "date") {
    if (band === "eve" && t.steps[0] === "FOOD" && t.steps.includes("CAFE")) s += 22;
    if (t.steps.includes("WALK") && rain) s -= 35;
    if (t.steps.includes("WALK") && ctx.weather === "clear" && band === "day") s += 10;
  }
  if (ctx.scenario === "family_kids") {
    if (t.steps.includes("ACTIVITY")) s += 18;
    if (t.steps.includes("WALK") && rain) s -= 28;
    if (ab === "toddler" && t.steps.includes("WALK") && rain) s -= 40;
    if (ab === "toddler" && t.indoorPreference === "indoor") s += 12;
  }
  if (ctx.scenario === "solo") {
    if (t.steps.length <= 2 && t.movementLevel === "low") s += 15;
    if (band === "day" && t.steps[0] === "FOOD") s += 8;
  }
  if (ctx.scenario === "group") {
    if (t.steps[0] === "FOOD") s += 10;
  }
  const dur = (t.durationMinMinutes + t.durationMaxMinutes) / 2;
  if (ctx.scenario === "solo" && dur > 200) s -= 12;
  if (ctx.scenario === "family_kids" && ab === "toddler" && dur > 280) s -= 15;

  return s;
}

/**
 * 시나리오에 맞는 템플릿만 골라 점수순 정렬.
 * TODO: 지역·학습 기반 재정렬은 `courseGenerator`에서 후처리.
 */
export function selectTemplates(ctx: ScenarioContext, catalog: CourseTemplate[] = COURSE_TEMPLATE_CATALOG): CourseTemplate[] {
  return catalog
    .filter((t) => t.scenarios.includes(ctx.scenario as ScenarioType))
    .map((t) => ({ t, score: scoreTemplateForContext(t, ctx) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}
