/**
 * 자연어 → ScenarioObject
 * 구현은 intentClassification.ts 에서 유지합니다.
 */

export {
  parseScenarioIntent,
  classifyIntent,
  detectStrictCategory,
  detectFoodSubCategory,
  detectMenuIntent,
  detectScenario,
  detectMoodAndConstraints,
  normIntentQuery,
  isCourseGenerationQuery,
  explainCourseGenerationMatch,
  intentCategoryToHomeTab,
  storeCategoryMatchesIntentCategory,
} from "./intentClassification";
export { buildFoodTagsForCard, inferFoodSubFromMenus, FOOD_SUB_RULES } from "./foodIntent";
export {
  augmentScenarioWithComposite,
  detectVibePreference,
  detectHardConstraints,
  detectSoftConstraints,
  detectFoodPreference,
  buildCompositeTagsForCard,
} from "./compositeIntent";
export { parseCompositeIntent } from "./intentClassification";
export { inferRecommendationMode } from "./recommendationMode";
