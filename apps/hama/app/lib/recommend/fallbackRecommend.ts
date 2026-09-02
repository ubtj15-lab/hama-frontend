/**
 * 메인 추천 거절 시 재랭킹 — exclude 집합에 이전 main_pick 병합.
 */
export function mergeExcludeForMainReject(excludeIds: readonly string[], mainPickId: string | null | undefined): string[] {
  const base = [...excludeIds].filter(Boolean);
  if (!mainPickId) return [...new Set(base)];
  return [...new Set([...base, mainPickId])];
}

/** 「다른 추천 보기」 — 현재 표시 덱(TOP3) 전체를 직전 노출로 병합. */
export function mergeExcludeForDisplayedDeck(
  excludeIds: readonly string[],
  deckIds: readonly string[]
): string[] {
  return [...new Set([...excludeIds, ...deckIds].map((id) => String(id ?? "").trim()).filter(Boolean))];
}
