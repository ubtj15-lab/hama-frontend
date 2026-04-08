import { getCourseCardExperimentGroup } from "@/lib/experiments/courseCardExperiment";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";

export type AnalyticsContext = {
  scenario?: string;
  intentType?: string | null;
  recommendationMode?: string | null;
  intentCategory?: string | null;
  foodSubCategory?: string | null;
  menuIntent?: string[] | null;
  card_rank?: number;
  experiment_group?: string;
  latency_ms?: number;
  course_id?: string;
};

export function analyticsFromScenario(obj: ScenarioObject | null): AnalyticsContext {
  if (!obj) {
    return {
      scenario: "generic",
      intentType: null,
      intentCategory: null,
      foodSubCategory: null,
      menuIntent: null,
      experiment_group: getCourseCardExperimentGroup(),
    };
  }
  return {
    scenario: obj.scenario,
    intentType: obj.intentType,
    recommendationMode: obj.recommendationMode ?? null,
    intentCategory: obj.intentCategory ?? null,
    foodSubCategory: obj.foodSubCategory ?? null,
    menuIntent: obj.menuIntent?.length ? [...obj.menuIntent] : null,
    experiment_group: getCourseCardExperimentGroup(),
  };
}

export function mergeLogPayload(
  base: AnalyticsContext,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    scenario: base.scenario,
    intentType: base.intentType,
    intentCategory: base.intentCategory,
    foodSubCategory: base.foodSubCategory,
    menuIntent: base.menuIntent,
    card_rank: base.card_rank,
    experiment_group: base.experiment_group ?? getCourseCardExperimentGroup(),
    latency_ms: base.latency_ms,
    course_id: base.course_id,
    ...extra,
  };
}
