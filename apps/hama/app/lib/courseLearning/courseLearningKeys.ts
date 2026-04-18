import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import type { PlaceType } from "@/lib/scenarioEngine/types";
import { resolveDateTimeBand } from "@/lib/scenarioEngine/dateCourseContext";
import { resolveWeatherCondition } from "@/lib/scenarioEngine/familyCourseContext";

export function stepPatternFromSteps(steps: PlaceType[]): string {
  return steps.join(">");
}

/**
 * 템플릿·시나리오 조합 키 (집계 행 id)
 */
export function buildPatternKey(input: {
  scenario: string;
  templateId: string;
  stepPattern: string;
  childAgeGroup?: string;
  weatherCondition?: string;
  timeOfDay?: string;
  dateTimeBand?: string;
}): string {
  return [
    input.scenario,
    input.childAgeGroup ?? "-",
    input.weatherCondition ?? "-",
    input.timeOfDay ?? "-",
    input.dateTimeBand ?? "-",
    input.templateId,
    input.stepPattern,
  ].join("|");
}

export function contextFromScenarioObject(obj: ScenarioObject): {
  scenario: string;
  childAgeGroup?: string;
  weatherCondition: string;
  timeOfDay?: string;
  dateTimeBand?: string;
} {
  const wx = resolveWeatherCondition(obj);
  const band = obj.scenario === "date" ? resolveDateTimeBand(obj) : undefined;
  return {
    scenario: obj.scenario,
    childAgeGroup: obj.childAgeGroup,
    weatherCondition: wx,
    timeOfDay: obj.timeOfDay,
    dateTimeBand: band,
  };
}
