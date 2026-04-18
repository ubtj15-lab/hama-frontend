export type {
  ScenarioType,
  UserIntentType,
  RecommendationMode,
  IntentCategory,
  FoodSubCategory,
  ScenarioObject,
  PlaceType,
  ScenarioConfig,
  CoursePlan,
  CourseStop,
  RejectReason,
  RankDebugEntry,
  ScenarioEngineDebugBundle,
  ChildAgeGroup,
  WeatherCondition,
  FamilyActivityType,
  DateTimeBand,
} from "./types";
export {
  inferChildAgeGroupFromQuery,
  resolveWeatherCondition,
  inferFamilyActivityType,
  isFamilyLikeScenario,
} from "./familyCourseContext";
export {
  inferDateTimeBandFromQuery,
  resolveDateTimeBand,
  defaultStartTimeForDateBand,
} from "./dateCourseContext";
export { inferDateCourseKind } from "./courseTemplateCatalog";
export {
  CourseLearningStore,
  logCourseLearningEvent,
  computeLearnedBoosts,
  computeTemplateSelectionLearnedBoost,
  COURSE_LEARNING_EVENT_WEIGHTS,
  MIN_IMPRESSIONS_FULL_WEIGHT,
  MIN_IMPRESSIONS_ANY,
  LEARNED_BOOST_MAX_TOTAL,
} from "@/lib/courseLearning";
export type {
  CourseLearningEventName,
  CourseLearningLogPayload,
  CoursePatternStats,
  PlaceCourseStats,
  LearnedBoostParts,
} from "@/lib/courseLearning";
export { runCourseLearningChecks } from "@/lib/courseLearning/courseLearning.scenarios";

export { SCENARIO_CONFIGS } from "./scenarioConfigs";
export { SCENARIO_ALIAS_GROUPS } from "./scenarioAliases";
export {
  parseScenarioIntent,
  parseCompositeIntent,
  classifyIntent,
  explainCourseGenerationMatch,
  isCourseGenerationQuery,
  detectStrictCategory,
  detectFoodSubCategory,
  detectMenuIntent,
  detectScenario,
  detectMoodAndConstraints,
  buildFoodTagsForCard,
  inferFoodSubFromMenus,
  FOOD_SUB_RULES,
  augmentScenarioWithComposite,
  detectVibePreference,
  detectHardConstraints,
  detectSoftConstraints,
  detectFoodPreference,
  buildCompositeTagsForCard,
  inferRecommendationMode,
} from "./parseScenarioIntent";
export { resolveScenarioConfig } from "./resolveScenarioConfig";
export { getScenarioTagWeights } from "./getScenarioTagWeights";
export { mapPlaceToPlaceType } from "./placeTypeMap";
export { configTagBoostRaw, placeTypePreferenceRaw } from "./scoringBoost";
export { scenarioTypeToRankKey, scenarioObjectToIntention } from "./scenarioRankBridge";
export {
  selectCourseTemplates,
  collectCandidatesByType,
  buildCourseCombination,
  buildTimeline,
  generateCourses,
} from "./courseEngine";
export { buildFunctionalCourseTitle, buildSituationCourseTitle, buildCourseBadges } from "./coursePresentation";
export {
  runCourseEngineScenarioChecks,
  runFamilyCourseTemplateChecks,
  runFamilyCourseWeatherAgeChecks,
  runDateCourseTimeWeatherChecks,
  runAdvancedCourseEngineChecks,
  runToddlerRainyIndoorPreferenceChecks,
  runDateEveningRestaurantCafeChecks,
  runLearningBoostRankImprovesChecks,
} from "./courseEngine.scenarios";
export { runIntentClassificationChecks } from "./intentClassification.scenarios";
export { runCompositeIntentChecks } from "./compositeIntent.scenarios";
export { runConversationScenarioChecks } from "@/lib/conversation/conversation.scenarios";
export { DEFAULT_DWELL_MINUTES, estimateTravelMinutes } from "./courseConstants";
export {
  logScenarioEngineDebug,
  getLastScenarioDebugBundle,
  setLastScenarioDebugBundle,
  isScenarioDebugEnabled,
} from "./scenarioDebug";
