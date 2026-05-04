/**
 * Minimal query → situation tag hints for open-beta analytics.
 * Heuristic only; no recommend impact.
 */
export function extractSituationTags(query: string): string[] {
  const q = String(query ?? "")
    .trim()
    .toLowerCase();
  if (!q) return [];

  const tags = new Set<string>();
  const pairs: Array<[RegExp, string]> = [
    [/아이|아이랑|키즈|영유아|유아/, "kids"],
    [/가족/, "family"],
    [/데이트/, "date"],
    [/카페|커피/, "cafe"],
    [/식당|맛집|밥|외식/, "food"],
    [/박물관|도서관|미술관|문화/, "culture"],
    [/비오는|비 온|실내/, "indoor_rainy"],
    [/혼밥|혼자/, "solo"],
  ];
  for (const [re, tag] of pairs) {
    if (re.test(q)) tags.add(tag);
  }
  return [...tags];
}
