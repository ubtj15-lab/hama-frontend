import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { resolveDateTimeBand } from "@/lib/scenarioEngine/dateCourseContext";
import { resolveWeatherCondition } from "@/lib/scenarioEngine/familyCourseContext";

/** 로그 공통: 시나리오·날씨·시간대 필드 */
export function courseScenarioFieldsFromObject(obj: ScenarioObject) {
  const wx = resolveWeatherCondition(obj);
  const dateTimeBand = obj.scenario === "date" ? resolveDateTimeBand(obj) : undefined;
  return {
    scenario: obj.scenario,
    child_age_group: obj.childAgeGroup ?? null,
    weather_condition: wx,
    time_of_day: obj.timeOfDay ?? null,
    date_time_band: dateTimeBand ?? null,
  };
}
