/**
 * 기존 코스 엔진 (`scenarioEngine` / `courseLearning`) 재노출 — 신규 `courseGenerator`·`courseTypes`와 병행.
 * 새 코드는 `@/lib/recommend`의 독립 모듈을 우선 사용하세요.
 */
export { generateCourses, buildTimeline, collectCandidatesByType } from "@/lib/scenarioEngine/courseEngine";
export type { CandidatesByType } from "@/lib/scenarioEngine/courseEngine";

export {
  COURSE_TEMPLATE_CATALOG,
  rankTemplatesForScenario,
  scoreTemplateSelection,
  inferDateCourseKind,
  buildNarrativeDescription,
  courseHasEnergyOrPlayStep,
  type CourseTemplateDefinition,
} from "@/lib/scenarioEngine/courseTemplateCatalog";

export {
  STEP_SCORE_WEIGHTS,
  computeStepScore,
  computeCourseScore,
  transitionNaturalness,
  averageTransitionScore,
  routeEfficiencyScore,
  weatherFitScore,
  soloFriendlyScore as soloFriendlyScoreLegacy,
  isExcludedFromCoursePool,
  type StepScoreContext,
} from "@/lib/scenarioEngine/courseScoring";

export { haversineKm as haversineKmLegacy, estimateTravelMinutes, estimateTravelMinutesFromKm } from "@/lib/scenarioEngine/courseConstants";

export { computeLearnedBoosts } from "@/lib/courseLearning/courseLearningBoost";
export {
  COURSE_LEARNING_EVENT_WEIGHTS,
  MIN_IMPRESSIONS_ANY,
  MIN_IMPRESSIONS_FULL_WEIGHT,
} from "@/lib/courseLearning/courseLearningConstants";
export { buildPatternKey as buildPatternKeyLegacy, contextFromScenarioObject, stepPatternFromSteps as stepPatternFromStepsLegacy } from "@/lib/courseLearning/courseLearningKeys";
export type { LearnedBoostParts } from "@/lib/courseLearning/courseLearningTypes";
