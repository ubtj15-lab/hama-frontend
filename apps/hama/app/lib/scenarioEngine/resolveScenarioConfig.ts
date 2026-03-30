import { SCENARIO_CONFIGS } from "./scenarioConfigs";
import type { ScenarioObject, ScenarioConfig, ScenarioType } from "./types";

export function resolveScenarioConfig(obj: ScenarioObject): ScenarioConfig {
  const conf = obj.confidence ?? 0;
  if (conf < 0.3 || obj.scenario === "generic") {
    return SCENARIO_CONFIGS.generic;
  }
  const cfg = SCENARIO_CONFIGS[obj.scenario as ScenarioType];
  return cfg ?? SCENARIO_CONFIGS.generic;
}
