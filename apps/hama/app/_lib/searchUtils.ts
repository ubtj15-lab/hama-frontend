export const CATEGORY_MAP: Record<string, string> = {
  카페: "CE7",
  커피: "CE7",
  카페테리아: "CE7",

  식당: "FD6",
  음식점: "FD6",
  밥집: "FD6",
  한식: "FD6",
  분식: "FD6",
  레스토랑: "FD6",

  미용실: "BK9",
  헤어샵: "BK9",
  헤어: "BK9",
  이발소: "BK9",
};

export function inferCategory(text: string): string | null {
  const lower = text.toLowerCase();
  for (const key of Object.keys(CATEGORY_MAP)) {
    if (lower.includes(key)) return CATEGORY_MAP[key];
  }
  return null;
}

export function buildSearchKeyword(rawText: string, categoryCode: string | null): string {
  let t = rawText.replace(/\s+/g, " ").trim();

  const stopPhrases = [
    "근처", "가까운", "주변", "근방", "주위",
    "찾아줘", "알려줘", "추천해줘", "검색해줘",
    "좀", "해줘",
  ];

  for (const p of stopPhrases) t = t.split(p).join("");
  t = t.trim();

  if (!t && categoryCode) {
    if (categoryCode === "CE7") return "카페";
    if (categoryCode === "FD6") return "식당";
    if (categoryCode === "BK9") return "미용실";
  }

  return t || rawText;
}
