import type { HomeCard } from "@/lib/storeTypes";
import type { PlaceType, ScenarioObject } from "@/lib/scenarioEngine/types";
import type { CourseTemplateShape } from "./courseLearningFeatures";
import {
  LEARNED_BOOST_MAX_TOTAL,
  LEARNED_FEATURE_MAX,
  LEARNED_PLACE_MAX,
  LEARNED_SCENARIO_PATTERN_MAX,
  LEARNED_TEMPLATE_MAX,
  MIN_IMPRESSIONS_ANY,
  MIN_IMPRESSIONS_FULL_WEIGHT,
  SMOOTHING_M,
} from "./courseLearningConstants";
import { inferCourseFeatureTags } from "./courseLearningFeatures";
import { buildPatternKey, contextFromScenarioObject, stepPatternFromSteps } from "./courseLearningKeys";
import type { CourseLearningStore } from "./courseLearningStore";
import type { CoursePatternStats, LearnedBoostParts, PlaceCourseStats } from "./courseLearningTypes";

function impressionWeight(impressions: number): number {
  if (impressions < MIN_IMPRESSIONS_ANY) return 0;
  return Math.min(1, impressions / MIN_IMPRESSIONS_FULL_WEIGHT);
}

/** 0~1 품질 점수 (노출 대비 긍정 행동 - 부정) */
function patternQuality(st: CoursePatternStats | undefined): number {
  if (!st || st.impressions < MIN_IMPRESSIONS_ANY) return 0;
  const imp = st.impressions + SMOOTHING_M;
  const engagement =
    (st.starts * 2 +
      st.saves * 1.6 +
      st.clicks * 1 +
      st.detailViews * 0.5 +
      st.routeClicks * 1.2 +
      st.callClicks * 0.8) /
    imp;
  const harm = (st.exits * 1.2 + st.skips * 0.9 + st.noActions * 0.4) / imp;
  const norm = Math.max(0, engagement * 0.55 - harm * 0.4);
  return Math.min(1, norm + Math.min(0.15, st.behaviorScoreSum / Math.max(1, st.impressions) / 80));
}

function placeQuality(p: PlaceCourseStats | undefined): number {
  if (!p || p.impressions < MIN_IMPRESSIONS_ANY) return 0;
  const imp = p.impressions + SMOOTHING_M;
  const pos = (p.starts * 2 + p.saves * 1.5 + p.clicks + p.detailViews * 0.5) / imp;
  const neg = p.exits / imp;
  return Math.max(0, Math.min(1, pos * 0.55 - neg * 0.35));
}

/**
 * 최종 코스 점수에 더할 학습 보정 (rule-based 0~100에 가산, 상한 적용)
 */
export function computeLearnedBoosts(
  store: CourseLearningStore | undefined,
  input: {
    obj: ScenarioObject;
    templateId: string;
    steps: PlaceType[];
    placeIds: string[];
    totalTravelMin: number;
    def: CourseTemplateShape & { id: string; steps: PlaceType[] };
    cards: HomeCard[];
  }
): LearnedBoostParts {
  if (!store) {
    return {
      templateBoost: 0,
      scenarioPatternBoost: 0,
      placeBoost: 0,
      featureBoost: 0,
      total: 0,
    };
  }

  const stepPattern = stepPatternFromSteps(input.steps);
  const ctx = contextFromScenarioObject(input.obj);
  const exactKey = buildPatternKey({ ...ctx, templateId: input.templateId, stepPattern });
  const aggKey = buildPatternKey({ ...ctx, templateId: "*", stepPattern });

  const exact = store.getPattern(exactKey);
  const agg = store.getPattern(aggKey);

  const qT = patternQuality(exact) * impressionWeight(exact?.impressions ?? 0);
  const qS = patternQuality(agg) * impressionWeight(agg?.impressions ?? 0);

  let placeAcc = 0;
  let placeN = 0;
  for (const id of input.placeIds) {
    const pq = placeQuality(store.getPlace(id)) * impressionWeight(store.getPlace(id)?.impressions ?? 0);
    if (pq > 0) {
      placeAcc += pq;
      placeN += 1;
    }
  }
  const placeAvg = placeN > 0 ? placeAcc / placeN : 0;

  const tags = inferCourseFeatureTags(input.def, input.cards, input.steps, input.totalTravelMin);
  let featureBoost =
    tags.length > 0 && qS > 0.2 ? LEARNED_FEATURE_MAX * qS * 0.35 * impressionWeight(agg?.impressions ?? 0) : 0;

  /** 템플릿 id 단위 보정은 `rankTemplatesForScenario`에서만 사용 (코스 점수와 이중 가산 방지) */
  /** 템플릿 단위 학습 — 랭킹용 full; 최종 코스 점수에는 비율만 반영(패턴·장소와 합산 후 상한) */
  const templateBoost = LEARNED_TEMPLATE_MAX * qT;
  let templateBoostForCourse = templateBoost * 0.42;
  let scenarioPatternBoost = LEARNED_SCENARIO_PATTERN_MAX * qS;
  let placeBoost = LEARNED_PLACE_MAX * placeAvg;

  let total = scenarioPatternBoost + placeBoost + featureBoost + templateBoostForCourse;
  if (total > LEARNED_BOOST_MAX_TOTAL) {
    const scale = LEARNED_BOOST_MAX_TOTAL / total;
    scenarioPatternBoost *= scale;
    placeBoost *= scale;
    featureBoost *= scale;
    templateBoostForCourse *= scale;
    total = LEARNED_BOOST_MAX_TOTAL;
  }

  let narrativeHint: LearnedBoostParts["narrativeHint"];
  const imp = Math.max(exact?.impressions ?? 0, agg?.impressions ?? 0);
  const famSc =
    input.obj.scenario === "family" ||
    input.obj.scenario === "family_kids" ||
    input.obj.scenario === "parent_child_outing";
  if (imp >= MIN_IMPRESSIONS_FULL_WEIGHT && total >= 7) {
    if (famSc && total >= 8) narrativeHint = "family_chosen";
    else if (input.obj.scenario === "date" && input.obj.dateTimeBand === "evening" && qS > 0.35)
      narrativeHint = "date_evening_popular";
    else if ((exact?.starts ?? 0) >= 3 || (agg?.starts ?? 0) >= 5) narrativeHint = "popular_start";
    else if ((exact?.saves ?? 0) >= 2 || (agg?.saves ?? 0) >= 4) narrativeHint = "saved_often";
  }

  return {
    templateBoost,
    scenarioPatternBoost,
    placeBoost,
    featureBoost,
    total,
    narrativeHint,
  };
}

/**
 * 템플릿 선택 점수(scoreTemplateSelection)에 더할 소량 가산 (대략 0~15)
 */
export function computeTemplateSelectionLearnedBoost(
  store: CourseLearningStore | undefined,
  def: { id: string; steps: PlaceType[] },
  obj: ScenarioObject
): number {
  if (!store) return 0;
  const stepPattern = stepPatternFromSteps(def.steps);
  const ctx = contextFromScenarioObject(obj);
  const exactKey = buildPatternKey({ ...ctx, templateId: def.id, stepPattern });
  const aggKey = buildPatternKey({ ...ctx, templateId: "*", stepPattern });
  const exact = store.getPattern(exactKey);
  const agg = store.getPattern(aggKey);
  const q = Math.max(patternQuality(exact) * impressionWeight(exact?.impressions ?? 0), patternQuality(agg) * 0.92 * impressionWeight(agg?.impressions ?? 0));
  return 15 * q;
}
