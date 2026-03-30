import { SCENARIO_CONFIGS } from "./scenarioConfigs";
import type { ScenarioType } from "./types";

export function getScenarioTagWeights(scenario: ScenarioType): Record<string, number> {
  return { ...(SCENARIO_CONFIGS[scenario]?.tagWeights ?? SCENARIO_CONFIGS.generic.tagWeights) };
}
