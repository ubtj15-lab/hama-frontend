import type { HomeCard } from "@/lib/storeTypes";
import { childFriendlyScore } from "@/lib/recommend/childFriendlyScore";
import type {
  CourseScoreBreakdown,
  PlaceCandidate,
  ScenarioContext,
  StepCategory,
  StepScoreBreakdown,
} from "./courseTypes";
import { haversineKm } from "./courseRouting";

/** 단계 점수 가중 (합 ~1) */
export const STEP_WEIGHTS = {
  categoryFit: 0.22,
  scenarioFit: 0.2,
  distanceFit: 0.16,
  servingTimeFit: 0.12,
  moodFit: 0.1,
  qualityFit: 0.1,
  scenarioSpecial: 0.1,
} as const;

export function inferStepCategoryFromCategory(category: string | null | undefined): StepCategory | null {
  const c = (category ?? "").toLowerCase();
  if (/(restaurant|food|한식|중식|일식|양식|밥|고기|횟집)/.test(c) || c === "restaurant") return "FOOD";
  if (c === "cafe" || /카페|디저트|베이커리/.test(c)) return "CAFE";
  if (c === "activity" || /체험|키즈|놀이|전시|만들기/.test(c)) return "ACTIVITY";
  if (/산책|공원|trail|walk/.test(c)) return "WALK";
  if (/museum|뮤지엄|갤러리|문화|영화|공연/.test(c)) return "CULTURE";
  return null;
}

export function resolveStepCategory(p: PlaceCandidate): StepCategory | null {
  if (p.stepCategory) return p.stepCategory;
  return inferStepCategoryFromCategory(p.category ?? p.categoryLabel);
}

const DRINK_HINT = /(?:커피|음료|차\b|티\b|베이커리|디저트)(?![^가-힣]*한식)/;
const MEAL_HINT = /(?:한식|중식|일식|양식|고기|점심|저녁|정식|코스|식사)/;

export function inferServingType(p: PlaceCandidate): "meal" | "light" | "drink" {
  if (p.servingType) return p.servingType;
  const hay = `${p.name} ${(p.tags ?? []).join(" ")}`;
  if (DRINK_HINT.test(hay) && !MEAL_HINT.test(hay)) return "drink";
  if (/(브런치|샐러드|샌드위치|라이트|가벼운)/.test(hay)) return "light";
  return "meal";
}

export function isDrinkOnlyFood(p: PlaceCandidate): boolean {
  return resolveStepCategory(p) === "FOOD" && inferServingType(p) === "drink";
}

function hay(p: PlaceCandidate): string {
  return `${p.name} ${(p.tags ?? []).join(" ")} ${(p.mood ?? []).join(" ")}`.toLowerCase();
}

/** 데이트 분위기 0~100 */
export function dateMoodScore(p: PlaceCandidate): number {
  const h = hay(p);
  let s = 45;
  if (/(분위기|감성|로맨틱|조용|대화|야경|뷰)/.test(h)) s += 35;
  if (/(가족|키즈|혼밥|회식)/.test(h)) s -= 25;
  return Math.max(0, Math.min(100, s));
}

/** 솔로 부담 없음 0~100 */
export function soloFriendlyScore(p: PlaceCandidate): number {
  const h = hay(p);
  let s = 55;
  if (/(가성비|혼밥|1인|빠른|간단|부담|캐주얼)/.test(h)) s += 30;
  if (/(코스|예약필수|프라이빗|룸)/.test(h)) s -= 15;
  return Math.max(0, Math.min(100, s));
}

function scenarioFit(p: PlaceCandidate, ctx: ScenarioContext, step: StepCategory): number {
  let s = 55;
  const h = hay(p);
  if (ctx.scenario === "date") {
    if (step === "FOOD" || step === "CAFE") s = dateMoodScore(p);
    else s += 10;
  } else if (ctx.scenario === "family_kids") {
    const cf = childFriendlyScore(placeToHomeCard(p));
    s = 40 + cf * 60;
    if (ctx.weather === "rainy" && step === "WALK") s -= 40;
  } else if (ctx.scenario === "solo") {
    s = soloFriendlyScore(p);
  } else if (ctx.scenario === "group") {
    if (/(단체|룸|대관|회식)/.test(h)) s += 25;
  }
  return Math.max(0, Math.min(100, s));
}

function categoryFit(p: PlaceCandidate, expected: StepCategory): number {
  const got = resolveStepCategory(p);
  if (!got) return 35;
  if (got !== expected) return 15;
  return 88;
}

function distanceFit(prev: PlaceCandidate | null, p: PlaceCandidate, maxLegKm?: number): number {
  if (!prev) return 80;
  const km = haversineKm(prev, p);
  if (km == null) return 65;
  const cap = maxLegKm ?? 12;
  if (km > cap) return Math.max(5, 55 - (km - cap) * 12);
  return Math.max(40, 100 - km * 8);
}

function servingTimeFit(p: PlaceCandidate, step: StepCategory, ctx: ScenarioContext): number {
  const srv = inferServingType(p);
  if (step === "FOOD" && srv === "drink") return 8;
  if (step === "FOOD" && ctx.mealRequired && srv === "drink") return 0;
  if (step === "FOOD" && srv === "meal") return 85;
  if (step === "CAFE") return 78;
  return 72;
}

function moodFit(p: PlaceCandidate, ctx: ScenarioContext): number {
  const h = hay(p);
  let s = 50;
  if (ctx.weather === "rainy" && /(실내|키즈|카페)/.test(h)) s += 15;
  if (ctx.weather === "clear" && /(루프탑|야경|산책)/.test(h)) s += 12;
  return Math.min(100, s);
}

function qualityFit(p: PlaceCandidate): number {
  const q = p.qualityScore;
  if (q == null) return 62;
  return Math.max(0, Math.min(100, q * 100));
}

function scenarioSpecial(p: PlaceCandidate, ctx: ScenarioContext, step: StepCategory): number {
  let s = 50;
  const cf = childFriendlyScore(placeToHomeCard(p));
  if (ctx.scenario === "family_kids") {
    s = 40 + cf * 55;
  } else if (ctx.scenario === "date") {
    s = dateMoodScore(p) * 0.85;
  } else if (ctx.scenario === "solo") {
    s = soloFriendlyScore(p) * 0.9;
  }
  if (ctx.childAgeGroup === "toddler" && step === "WALK" && ctx.weather === "rainy") s -= 30;
  return Math.max(0, Math.min(100, s));
}

export function placeToHomeCard(p: PlaceCandidate): HomeCard {
  return {
    id: p.id,
    name: p.name,
    category: p.category ?? null,
    categoryLabel: p.categoryLabel ?? undefined,
    tags: p.tags,
    mood: p.mood,
    with_kids: p.with_kids,
  };
}

function penaltiesForStep(p: PlaceCandidate, step: StepCategory, ctx: ScenarioContext): number {
  let pen = 0;
  if (step === "FOOD" && isDrinkOnlyFood(p)) pen += 55;
  if (ctx.scenario === "solo" && ctx.mealRequired && step === "FOOD" && inferServingType(p) === "drink") pen += 40;
  return pen;
}

export function scoreStep(
  p: PlaceCandidate,
  step: StepCategory,
  ctx: ScenarioContext,
  prev: PlaceCandidate | null
): { score: number; breakdown: StepScoreBreakdown } {
  const w = STEP_WEIGHTS;
  const cat = categoryFit(p, step);
  const scn = scenarioFit(p, ctx, step);
  const dst = distanceFit(prev, p, ctx.maxLegKm);
  const st = servingTimeFit(p, step, ctx);
  const mood = moodFit(p, ctx);
  const q = qualityFit(p);
  const sp = scenarioSpecial(p, ctx, step);
  const pen = penaltiesForStep(p, step, ctx);

  const raw =
    w.categoryFit * cat +
    w.scenarioFit * scn +
    w.distanceFit * dst +
    w.servingTimeFit * st +
    w.moodFit * mood +
    w.qualityFit * q +
    w.scenarioSpecial * sp;

  const score = Math.max(0, Math.min(100, raw - pen));

  return {
    score,
    breakdown: {
      categoryFit: cat,
      scenarioFit: scn,
      distanceFit: dst,
      servingTimeFit: st,
      moodFit: mood,
      qualityFit: q,
      childFriendlyFit: childFriendlyScore(placeToHomeCard(p)) * 100,
      dateMoodFit: ctx.scenario === "date" ? dateMoodScore(p) : 50,
      soloFriendlyFit: ctx.scenario === "solo" ? soloFriendlyScore(p) : 50,
      penalties: pen,
    },
  };
}

export function transitionNaturalness(a: StepCategory, b: StepCategory): number {
  const key = `${a}>${b}`;
  const table: Record<string, number> = {
    "FOOD>CAFE": 95,
    "FOOD>ACTIVITY": 92,
    "FOOD>WALK": 78,
    "CAFE>WALK": 90,
    "CAFE>ACTIVITY": 88,
    "ACTIVITY>CAFE": 93,
    "ACTIVITY>FOOD": 88,
    "WALK>CAFE": 92,
    "WALK>FOOD": 75,
  };
  return table[key] ?? 70;
}

/** 업종별 체류 시간 — 코스 총 시간용 (결정적 지터) */
export function getEstimatedStayMinutes(step: StepCategory, p: PlaceCandidate): number {
  const srv = inferServingType(p);
  const seed = p.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const jitter = seed % 12;
  switch (step) {
    case "FOOD":
      if (srv === "drink") return 42;
      if (srv === "light") return 52;
      return 72 + jitter;
    case "CAFE":
      return 52 + jitter;
    case "ACTIVITY":
      return 92 + jitter;
    case "WALK":
      return 42 + jitter % 8;
    case "CULTURE":
      return 72 + jitter;
    default:
      return 60;
  }
}

/**
 * 코스 단계 시퀀스와 날씨·시나리오 정합 (0~100, 높을수록 좋음).
 * 비 오는 날 WALK 포함 시 감점 — 테스트·UI에서 `scenarioFlowFit` 명칭으로 사용.
 */
export function scenarioFlowFit(ctx: ScenarioContext, stepCategories: StepCategory[]): number {
  let v = 100;
  if (ctx.weather === "rainy" && stepCategories.includes("WALK")) v -= 38;
  if (ctx.weather === "rainy" && ctx.scenario === "family_kids" && stepCategories.includes("WALK")) v -= 12;
  return Math.max(0, v);
}

function duplicateIndustryPenalty(places: PlaceCandidate[]): number {
  const cats = places.map((p) => inferStepCategoryFromCategory(p.category ?? p.categoryLabel) ?? "OTHER");
  let pen = 0;
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      if (cats[i] === cats[j] && cats[i] === "CAFE") pen += 12;
    }
  }
  return pen;
}

export function scoreCourse(input: {
  ctx: ScenarioContext;
  steps: { place: PlaceCandidate; stepCategory: StepCategory; stepScore: number }[];
  routeScore100: number;
  templateFitScore: number;
  learnedBoost: number;
}): { score: number; breakdown: CourseScoreBreakdown } {
  const { ctx, steps, routeScore100, templateFitScore, learnedBoost } = input;
  const avgStep = steps.length ? steps.reduce((s, x) => s + x.stepScore, 0) / steps.length : 0;

  let trans = 80;
  if (steps.length >= 2) {
    let s = 0;
    for (let i = 0; i < steps.length - 1; i++) {
      s += transitionNaturalness(steps[i]!.stepCategory, steps[i + 1]!.stepCategory);
    }
    trans = s / (steps.length - 1);
  }

  const diversityScore = Math.max(0, 100 - duplicateIndustryPenalty(steps.map((s) => s.place)));

  let penalties = 0;
  const places = steps.map((s) => s.place);
  if (ctx.scenario === "family_kids" && ctx.childAgeGroup === "toddler") {
    const directKm = steps.length < 2 ? null : haversineKm(places[0]!, places[places.length - 1]!);
    if (directKm != null && directKm > 25) penalties += 15;
  }

  const stepsAggregate = avgStep * 0.45 + trans * 0.25 + routeScore100 * 0.15 + diversityScore * 0.1 + templateFitScore * 0.05;

  const total = Math.max(
    0,
    Math.min(100, stepsAggregate + learnedBoost * 0.12 - penalties)
  );

  return {
    score: total,
    breakdown: {
      stepsAggregate: avgStep,
      transitionScore: trans,
      routeScore: routeScore100,
      diversityScore,
      templateFitScore,
      learnedBoost,
      penalties,
    },
  };
}
