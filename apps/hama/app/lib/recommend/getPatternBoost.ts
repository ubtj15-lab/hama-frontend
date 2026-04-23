/**
 * `recommendation_pattern_stats` 와 `courseLearningKeys.buildPatternKey` 연동
 */
import {
  buildPatternKey,
  contextFromScenarioObject,
  stepPatternFromSteps,
} from "@/lib/courseLearning/courseLearningKeys";
import type { PlaceType, ScenarioObject } from "@/lib/scenarioEngine/types";

export function buildPatternKeyForCourse(input: {
  obj: ScenarioObject;
  templateId: string;
  steps: PlaceType[];
}): string {
  const ctx = contextFromScenarioObject(input.obj);
  return buildPatternKey({
    ...ctx,
    templateId: input.templateId,
    stepPattern: stepPatternFromSteps(input.steps),
  });
}

export function getPatternBoostFromMap(
  patternKey: string,
  map: ReadonlyMap<string, number> | Readonly<Record<string, number>> | undefined
): number {
  if (!map) return 0;
  if (map instanceof Map) return map.get(patternKey) ?? 0;
  const rec = map as Readonly<Record<string, number>>;
  return rec[patternKey] ?? 0;
}

export async function fetchRecommendationPatternBoostMap(
  scenario: string
): Promise<Map<string, number>> {
  if (typeof window === "undefined") return new Map();
  try {
    const res = await fetch(
      `/api/recommendation/pattern-stats?scenario=${encodeURIComponent(scenario)}`,
      { method: "GET" }
    );
    const j = (await res.json()) as { boosts?: Record<string, number> };
    return new Map(Object.entries(j.boosts ?? {}));
  } catch {
    return new Map();
  }
}
