/**
 * 코스 추천 엔진 (독립 모듈) — 기존 `scenarioEngine/courseEngine`과 병행 가능.
 * TODO: API 레이어에서 `placeCandidateFromHomeCard`로 풀 변환 후 호출.
 */

import type { HomeCard } from "@/lib/storeTypes";
import { buildPatternKey, placeLearnedBoost, patternLearnedBoost, stepPatternFromSteps, type CourseLearningInput } from "./courseLearning";
import { computeRouteMetrics, formatHumanReadableDuration } from "./courseRouting";
import {
  getEstimatedStayMinutes,
  isDrinkOnlyFood,
  resolveStepCategory,
  scoreCourse,
  scoreStep,
} from "./courseScoring";
import { scoreTemplateForContext, selectTemplates } from "./courseTemplates";
import type {
  CourseStepResult,
  CourseTemplate,
  GeneratedCourse,
  PlaceCandidate,
  ScenarioContext,
  StepCategory,
} from "./courseTypes";

export type GenerateCoursesOptions = {
  maxCourses?: number;
  learning?: CourseLearningInput;
  /** 상위 N개 템플릿만 시도 */
  maxTemplateTry?: number;
};

function buildTitle(ctx: ScenarioContext, tpl: CourseTemplate, places: PlaceCandidate[]): string {
  const lead = places[0]?.name ?? "첫 장소";
  const tag = tpl.vibeTags[0] ?? "추천";
  if (ctx.scenario === "date") return `${lead}부터 이어지는 ${tag} 데이트 코스`;
  if (ctx.scenario === "family_kids") return `아이와 함께하는 ${tag} 외출 코스`;
  if (ctx.scenario === "solo") return `부담 없는 ${tag} 혼밥 코스`;
  return `${lead} 중심 ${tag} 모임 코스`;
}

function buildDescription(tpl: CourseTemplate, totalMin: number): string {
  const flow = tpl.steps.join(" → ");
  return `${flow} 순으로 약 ${Math.round(totalMin / 60)}시간 내외 동선이에요. ${tpl.vibeTags.slice(0, 2).join(", ")} 흐름을 살렸어요.`;
}

/** 한 단계 후보 — StepCategory 일치하는 장소만 (없으면 빈 배열). */
export function pickCandidatesForStep(
  step: StepCategory,
  places: PlaceCandidate[],
  ctx: ScenarioContext,
  prev: PlaceCandidate | null,
  limit: number
): PlaceCandidate[] {
  const pool = places.filter((p) => resolveStepCategory(p) === step);
  const scored = pool
    .map((p) => {
      const { score } = scoreStep(p, step, ctx, prev);
      return { p, score };
    })
    .filter((x) => x.score >= 12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
  return scored;
}

/**
 * 단일 템플릿을 채워 한 코스 생성.
 * TODO: 빔 서치 / 브랜드 중복 제거 등은 여기서 확장.
 */
export function generateCourseFromTemplate(
  template: CourseTemplate,
  places: PlaceCandidate[],
  ctx: ScenarioContext,
  learning?: CourseLearningInput
): GeneratedCourse | null {
  const used = new Set<string>();
  const chosen: PlaceCandidate[] = [];
  const stepResults: CourseStepResult[] = [];
  let prev: PlaceCandidate | null = null;
  let order = 0;

  for (const step of template.steps) {
    const pool = places.filter((p) => !used.has(p.id));
    const candidates = pickCandidatesForStep(step, pool, ctx, prev, 24);
    const best =
      candidates.find((p) => {
        if (step === "FOOD" && isDrinkOnlyFood(p)) return false;
        if (ctx.mealRequired && step === "FOOD" && isDrinkOnlyFood(p)) return false;
        return true;
      }) ?? candidates[0];
    if (!best) return null;
    used.add(best.id);
    chosen.push(best);
    const stay = getEstimatedStayMinutes(step, best);
    const scored = scoreStep(best, step, ctx, prev);
    stepResults.push({
      order: order++,
      stepCategory: step,
      place: best,
      stayMinutes: stay,
      stepScore: scored.score,
      breakdown: scored.breakdown,
    });
    prev = best;
  }

  const route = computeRouteMetrics(chosen);
  const routeScore100 = Math.max(0, 100 - route.backtrackPenalty * 0.35 - Math.min(30, route.pathKm * 1.5));
  const templateFitScore = scoreTemplateForContext(template, ctx);

  const stepPattern = stepPatternFromSteps(template.steps);
  const patternKey = buildPatternKey({
    scenario: ctx.scenario,
    childAgeGroup: ctx.childAgeGroup,
    weather: ctx.weather,
    timeOfDay: ctx.timeOfDay,
    templateId: template.id,
    stepPattern,
  });
  const pStat = learning?.getPattern(patternKey);
  const pBoost = patternLearnedBoost(pStat);
  const plBoost = placeLearnedBoost(chosen.map((p) => learning?.getPlace(p.id)));
  const learnedBoost = Math.min(12, pBoost + plBoost);

  const { score, breakdown } = scoreCourse({
    ctx,
    steps: stepResults.map((s) => ({
      place: s.place,
      stepCategory: s.stepCategory,
      stepScore: s.stepScore,
    })),
    routeScore100,
    templateFitScore,
    learnedBoost,
  });

  const travelMin = route.travelMinutesTotal;
  const dwell = stepResults.reduce((s, x) => s + x.stayMinutes, 0);
  const totalDurationMin = dwell + travelMin;
  const humanReadableDuration = formatHumanReadableDuration(totalDurationMin);
  const id = `course-${template.id}-${chosen.map((p) => p.id).join("-")}`;

  return {
    id,
    title: buildTitle(ctx, template, chosen),
    steps: stepResults,
    route,
    totalDurationMin,
    humanReadableDuration,
    description: buildDescription(template, totalDurationMin),
    score,
    breakdown,
    templateId: template.id,
  };
}

function jaccardPlaceSets(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 비슷한 장소 조합 제거 — 상위 점수 우선. TODO: 템플릿 다양성 가중은 여기서 확장 */
export function diversifyCourses(courses: GeneratedCourse[], max = 3): GeneratedCourse[] {
  const sorted = [...courses].sort((a, b) => b.score - a.score);
  const out: GeneratedCourse[] = [];
  for (const c of sorted) {
    if (out.length >= max) break;
    const ids = c.steps.map((s) => s.place.id);
    if (out.some((o) => jaccardPlaceSets(ids, o.steps.map((s) => s.place.id)) > 0.66)) continue;
    out.push(c);
  }
  while (out.length < max) {
    const next = sorted.find((c) => !out.includes(c));
    if (!next) break;
    out.push(next);
  }
  return out.slice(0, max);
}

/**
 * 시나리오에 맞는 코스 여러 개 생성.
 */
export function generateCourses(
  ctx: ScenarioContext,
  places: PlaceCandidate[],
  opts: GenerateCoursesOptions = {}
): GeneratedCourse[] {
  const max = opts.maxCourses ?? 3;
  const tryN = opts.maxTemplateTry ?? 14;
  const templates = selectTemplates(ctx).slice(0, tryN);
  const built: GeneratedCourse[] = [];
  for (const tpl of templates) {
    const g = generateCourseFromTemplate(tpl, places, ctx, opts.learning);
    if (g) built.push(g);
  }
  return diversifyCourses(built, max);
}

/** `HomeCard` 풀 → 후보 변환 (기존 스토어와 연결용) */
export function placeCandidateFromHomeCard(card: HomeCard): PlaceCandidate {
  return {
    id: card.id,
    name: card.name,
    lat: card.lat,
    lng: card.lng,
    category: card.category,
    categoryLabel: card.categoryLabel,
    tags: card.tags,
    mood: card.mood,
    with_kids: card.with_kids,
    reservationRequired: card.reservation_required,
  };
}
