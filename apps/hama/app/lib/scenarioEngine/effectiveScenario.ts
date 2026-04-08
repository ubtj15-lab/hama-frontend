import type { RecommendationMode, ScenarioObject } from "./types";
import { detectStrictCategory } from "./intentClassification";
import { normIntentQuery } from "./intentQueryNormalize";

/**
 * 사용자 모드 토글 시 ScenarioObject 유지 + recommendationMode·intentType만 정합성 있게 맞춤.
 */
export function applyRecommendationModeToScenario(
  base: ScenarioObject,
  mode: RecommendationMode
): ScenarioObject {
  const q = normIntentQuery(base.rawQuery);
  if (mode === "course") {
    return {
      ...base,
      recommendationMode: "course",
      intentType: "course_generation",
    };
  }

  let intentType = base.intentType;
  if (intentType === "course_generation") {
    intentType = detectStrictCategory(q) ? "search_strict" : "scenario_recommendation";
  }

  let intentCategory = base.intentCategory;
  let intentStrict = base.intentStrict;
  if (intentType === "search_strict") {
    const cat = intentCategory ?? detectStrictCategory(q);
    intentCategory = cat ?? undefined;
    intentStrict = cat ? true : undefined;
  }

  return {
    ...base,
    recommendationMode: "single",
    intentType,
    intentCategory,
    intentStrict,
  };
}
