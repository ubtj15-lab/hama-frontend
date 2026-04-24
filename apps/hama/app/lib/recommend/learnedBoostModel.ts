/**
 * 행동 기반 learned_boost — 노출 수에 따른 감쇠 후 0~100 스케일.
 */
export function behaviorBoostVisibilityFactor(globalImpressions: number): number {
  if (globalImpressions < 30) return 0;
  if (globalImpressions < 100) return 0.3;
  return 1;
}

/** raw 누적(이벤트 가중 합) → 0~100 단조 증가, 과도한 한 방향 편향 완화 */
export function normalizeBehaviorRawToScore(raw: number): number {
  if (!Number.isFinite(raw) || raw === 0) return 50;
  const x = Math.max(-80, Math.min(80, raw));
  return Math.round(50 + 50 * Math.tanh(x / 28));
}
