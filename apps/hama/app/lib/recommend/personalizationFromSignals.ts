import type { ScenarioObject } from "@/lib/scenarioEngine/types";

export type PersonalizationHints = {
  preferredTags: string[];
  avoidTags: string[];
  preferredScenarios: string[];
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * 0~100 — 태그·시나리오 선호 일치도 (가중 합의 단순 정규화).
 * 최종 점수에는 ~12%만 블렌딩.
 */
export function personalizationFitScore(
  blob: string,
  scenarioObject: ScenarioObject | null | undefined,
  hints: PersonalizationHints
): number {
  const b = norm(blob);
  let hit = 0;
  let max = 1;

  for (const t of hints.preferredTags) {
    const x = norm(t).replace(/\s/g, "");
    if (x.length < 2) continue;
    max += 3;
    if (b.includes(x) || b.includes(norm(t))) hit += 3;
  }

  for (const t of hints.avoidTags) {
    const x = norm(t).replace(/\s/g, "");
    if (x.length < 2) continue;
    max += 4;
    if (b.includes(x) || b.includes(norm(t))) hit -= 4;
  }

  const sc = scenarioObject?.scenario;
  if (sc && hints.preferredScenarios.includes(sc)) {
    max += 5;
    hit += 5;
  }

  if (max <= 1 && hints.preferredTags.length === 0 && hints.avoidTags.length === 0) {
    return 50;
  }

  const ratio = max > 0 ? (hit + max * 0.35) / (max * 1.35) : 0.5;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

export const PERSONALIZATION_BLEND = 0.125;
