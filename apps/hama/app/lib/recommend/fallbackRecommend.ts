/**
 * 메인 추천 거절 시 재랭킹 — exclude 집합에 이전 main_pick 병합.
 */
export function mergeExcludeForMainReject(excludeIds: readonly string[], mainPickId: string | null | undefined): string[] {
  const base = [...excludeIds].filter(Boolean);
  if (!mainPickId) return [...new Set(base)];
  return [...new Set([...base, mainPickId])];
}
