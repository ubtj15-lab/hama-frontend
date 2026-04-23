/**
 * 행동 로그 집계와 연동할 최소 인터페이스 — Supabase `course_pattern_stats` 등 매핑.
 * impressions < MIN_IMPRESSIONS_FOR_LEARNED 이면 boost ≈ 0.
 */

export const MIN_IMPRESSIONS_FOR_LEARNED = 20;

export type PatternStat = {
  impressions: number;
  /** 집계된 행동 점수 합 또는 정규화 전 점수 */
  behaviorScore: number;
};

export type PlaceStat = {
  impressions: number;
  behaviorScore: number;
};

export type CourseLearningInput = {
  getPattern(patternKey: string): PatternStat | undefined;
  getPlace(placeId: string): PlaceStat | undefined;
};

export function buildPatternKey(input: {
  scenario: string;
  childAgeGroup?: string;
  weather: string;
  timeOfDay: string;
  templateId: string;
  stepPattern: string;
}): string {
  return [
    input.scenario,
    input.childAgeGroup ?? "-",
    input.weather,
    input.timeOfDay,
    input.templateId,
    input.stepPattern,
  ].join("|");
}

export function stepPatternFromSteps(steps: string[]): string {
  return steps.join(">");
}

/**
 * 노출이 충분할 때만 패턴 boost 적용. 20 미만은 거의 0.
 * TODO: `courseLearningBoost`와 가중치 통합 시 계수만 조정.
 */
export function patternLearnedBoost(stat: PatternStat | undefined): number {
  if (!stat || stat.impressions < MIN_IMPRESSIONS_FOR_LEARNED) return 0;
  const imp = stat.impressions;
  const scale = Math.min(1, (imp - MIN_IMPRESSIONS_FOR_LEARNED) / 40 + 0.35);
  const q = Math.max(0, Math.min(1, stat.behaviorScore / Math.max(imp, 1) / 8));
  return Math.min(12, q * 12 * scale);
}

export function placeLearnedBoost(stats: (PlaceStat | undefined)[]): number {
  let acc = 0;
  let n = 0;
  for (const st of stats) {
    if (!st || st.impressions < MIN_IMPRESSIONS_FOR_LEARNED) continue;
    const scale = Math.min(1, (st.impressions - MIN_IMPRESSIONS_FOR_LEARNED) / 30 + 0.3);
    const q = Math.max(0, Math.min(1, st.behaviorScore / Math.max(st.impressions, 1) / 8));
    acc += Math.min(4, q * 4 * scale);
    n += 1;
  }
  if (n === 0) return 0;
  return Math.min(8, acc / n);
}

/** 인상 수에 따른 학습 가중 (0~1) — 설명·디버그용 */
export function learnedImpressionWeight(impressions: number): number {
  if (impressions < MIN_IMPRESSIONS_FOR_LEARNED) return impressions <= 0 ? 0 : impressions / MIN_IMPRESSIONS_FOR_LEARNED * 0.05;
  return Math.min(1, 0.5 + (impressions - MIN_IMPRESSIONS_FOR_LEARNED) / 80);
}
