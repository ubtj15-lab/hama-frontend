/**
 * 자연어 검색 의도 파싱 + 매장 점수화 (검색 페이지 전용)
 */

export type CompanionAxis = "kids" | "family" | "date" | "solo" | "company";
export type CategoryAxis = "restaurant" | "cafe" | "salon" | "activity";
export type ConditionAxis = "indoor" | "parking" | "nearby" | "value" | "open_now";

export type ParsedSearchIntent = {
  companions: CompanionAxis[];
  categories: CategoryAxis[];
  moodHints: string[];
  conditions: ConditionAxis[];
  /** 지역명(행정동/시 등) — address/area 부분일치에 사용 */
  areaTerms: string[];
  /** 사전 문구 매칭 시 라벨 */
  phraseMatched: string | null;
  /** 정규화된 원문(공백 제거 소문자 등) */
  normalizedQuery: string;
};

export type StoreScoreInput = {
  name: string;
  category: string;
  area?: string | null;
  address?: string | null;
  mood?: string[] | null;
  tags?: string[] | null;
  with_kids?: boolean | null;
  lat?: number | null;
  lng?: number | null;
  distanceKm?: number | null;
};

const SCORE_CATEGORY = 5;
const SCORE_TAG = 4;
const SCORE_MOOD = 3;
const SCORE_TEXT = 2;
const SCORE_NAME_DIRECT = 45;
const SCORE_DISTANCE_MAX = 5;

function normCompact(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function normLoose(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** 문구 사전: 긴 패턴 우선 */
const PHRASE_RULES: {
  re: RegExp;
  label: string;
  patch: (p: ParsedSearchIntent) => void;
}[] = [
  {
    re: /오산\s*아이랑|오산\s*애기|오산.*키즈|오산\s*가족/u,
    label: "오산_아이_가족",
    patch: (p) => {
      p.areaTerms.push("오산");
      if (!p.companions.includes("kids")) p.companions.push("kids");
      if (!p.companions.includes("family")) p.companions.push("family");
    },
  },
  {
    re: /동탄\s*데이트|동탄.*코스/u,
    label: "동탄_데이트",
    patch: (p) => {
      p.areaTerms.push("동탄");
      if (!p.companions.includes("date")) p.companions.push("date");
    },
  },
  {
    re: /아이랑\s*같이|애기랑|아이와|키즈|유아|어린이|육아/u,
    label: "아이_동반",
    patch: (p) => {
      if (!p.companions.includes("kids")) p.companions.push("kids");
      if (!p.companions.includes("family")) p.companions.push("family");
    },
  },
  {
    re: /가족이랑|가족과|부모님|가족단위/u,
    label: "가족",
    patch: (p) => {
      if (!p.companions.includes("family")) p.companions.push("family");
    },
  },
  {
    re: /데이트|커플|로맨틱/u,
    label: "데이트",
    patch: (p) => {
      if (!p.companions.includes("date")) p.companions.push("date");
    },
  },
  {
    re: /혼자|혼밥|1인|나혼자/u,
    label: "혼자",
    patch: (p) => {
      if (!p.companions.includes("solo")) p.companions.push("solo");
    },
  },
  {
    re: /회식|단체|모임|뒤풀이/u,
    label: "회식",
    patch: (p) => {
      if (!p.companions.includes("company")) p.companions.push("company");
    },
  },
  {
    re: /조용한|한적|잔잔/u,
    label: "무드_조용",
    patch: (p) => {
      p.moodHints.push("조용", "한적", "잔잔");
    },
  },
  {
    re: /분위기\s*좋은|감성|아늑|인스타|예쁜/u,
    label: "무드_분위기",
    patch: (p) => {
      p.moodHints.push("분위기", "감성", "아늑", "예쁜", "인스타");
    },
  },
  {
    re: /실내/u,
    label: "조건_실내",
    patch: (p) => {
      if (!p.conditions.includes("indoor")) p.conditions.push("indoor");
    },
  },
  {
    re: /주차/u,
    label: "조건_주차",
    patch: (p) => {
      if (!p.conditions.includes("parking")) p.conditions.push("parking");
    },
  },
  {
    re: /가까운|근처|주변|동네/u,
    label: "조건_가까움",
    patch: (p) => {
      if (!p.conditions.includes("nearby")) p.conditions.push("nearby");
    },
  },
  {
    re: /가성비|저렴|착한가격/u,
    label: "조건_가성비",
    patch: (p) => {
      if (!p.conditions.includes("value")) p.conditions.push("value");
    },
  },
  {
    re: /영업\s*중|지금\s*열/u,
    label: "조건_영업",
    patch: (p) => {
      if (!p.conditions.includes("open_now")) p.conditions.push("open_now");
    },
  },
  {
    re: /두부마을|두부|순두부|청국장|콩비지|순두부찌개|두부\s*전골/u,
    label: "카테_두부한식",
    patch: (p) => {
      if (!p.categories.includes("restaurant")) p.categories.push("restaurant");
    },
  },
  {
    re: /식당|맛집|밥집|한식|중식|양식|일식|음식점/u,
    label: "카테_식당",
    patch: (p) => {
      if (!p.categories.includes("restaurant")) p.categories.push("restaurant");
    },
  },
  {
    re: /카페|커피|브런치/u,
    label: "카테_카페",
    patch: (p) => {
      if (!p.categories.includes("cafe")) p.categories.push("cafe");
    },
  },
  {
    re: /미용|헤어|네일|살롱|뷰티/u,
    label: "카테_미용",
    patch: (p) => {
      if (!p.categories.includes("salon")) p.categories.push("salon");
    },
  },
  {
    re: /액티비티|체험|놀거리|키즈카페|실내\s*놀이|보드게임/u,
    label: "카테_액티",
    patch: (p) => {
      if (!p.categories.includes("activity")) p.categories.push("activity");
    },
  },
];

function emptyIntent(raw: string): ParsedSearchIntent {
  return {
    companions: [],
    categories: [],
    moodHints: [],
    conditions: [],
    areaTerms: [],
    phraseMatched: null,
    normalizedQuery: normCompact(raw),
  };
}

export function parseSearchIntent(query: string): ParsedSearchIntent {
  const q = String(query ?? "").trim();
  const base = emptyIntent(q);
  if (!q) return base;

  const loose = normLoose(q);
  base.normalizedQuery = normCompact(q);

  const matchedLabels: string[] = [];
  const sortedRules = [...PHRASE_RULES].sort((a, b) => b.re.source.length - a.re.source.length);
  for (const rule of sortedRules) {
    rule.re.lastIndex = 0;
    if (rule.re.test(loose)) {
      rule.patch(base);
      matchedLabels.push(rule.label);
    }
  }
  if (matchedLabels.length > 0) {
    base.phraseMatched = matchedLabels.join(",");
  }

  /* 일반 지역명(간단 휴리스틱): 시·구 토큰 */
  const areaPick = loose.match(
    /(오산|동탄|수원|성남|판교|분당|한남|홍대|강남|신촌|이태원|건대|잠실|광화문|종로)/u
  );
  if (areaPick && !base.areaTerms.includes(areaPick[1])) {
    base.areaTerms.push(areaPick[1]);
  }

  /* 중복 제거 */
  base.companions = Array.from(new Set(base.companions));
  base.categories = Array.from(new Set(base.categories));
  base.moodHints = Array.from(new Set(base.moodHints.map(normCompact)));
  base.conditions = Array.from(new Set(base.conditions));
  base.areaTerms = Array.from(new Set(base.areaTerms));

  return base;
}

function storeCategoryKey(cat: string): CategoryAxis | null {
  const c = normCompact(cat);
  if (c === "restaurant" || c.includes("식당") || c.includes("fd6")) return "restaurant";
  if (c === "cafe" || c.includes("카페") || c.includes("ce7")) return "cafe";
  if (c === "salon" || c.includes("미용") || c.includes("bk9") || c.includes("beauty")) return "salon";
  if (c === "activity" || c.includes("액티") || c.includes("활동")) return "activity";
  return null;
}

function companionScore(store: StoreScoreInput, intent: ParsedSearchIntent): number {
  if (intent.companions.length === 0) return 0;
  let s = 0;
  const tags = (store.tags ?? []).map(normCompact).join(" ");
  const mood = (store.mood ?? []).map(normCompact).join(" ");
  const blob = `${tags} ${mood}`;
  const wKids = store.with_kids === true;

  if (intent.companions.includes("kids") || intent.companions.includes("family")) {
    if (wKids) s += SCORE_TAG;
    if (/키즈|유아|아이|가족|키친|런앤|놀이/.test(blob)) s += SCORE_MOOD;
  }
  if (intent.companions.includes("date")) {
    if (/데이트|로맨틱|커플|분위기|감성|야경|와인|캔들/.test(blob)) s += SCORE_MOOD;
  }
  if (intent.companions.includes("solo")) {
    if (/혼밥|혼자|1인|바테이블|카운터/.test(blob)) s += SCORE_MOOD;
  }
  if (intent.companions.includes("company")) {
    if (/회식|단체|룸|단체석|대관|모임/.test(blob)) s += SCORE_MOOD;
  }
  return s;
}

function conditionScore(store: StoreScoreInput, intent: ParsedSearchIntent): number {
  if (intent.conditions.length === 0) return 0;
  const tags = (store.tags ?? []).map(normCompact).join(" ");
  const mood = (store.mood ?? []).map(normCompact).join(" ");
  const blob = `${tags} ${mood}`;
  let s = 0;
  for (const c of intent.conditions) {
    if (c === "parking" && /주차|parking|무료주차|발렛/.test(blob)) s += SCORE_TAG;
    if (c === "indoor" && /실내|indoor|키즈카페|체험/.test(blob)) s += SCORE_MOOD;
    if (c === "value" && /가성비|저렴|런치|점심특선/.test(blob)) s += SCORE_MOOD;
    if (c === "open_now") s += 0;
    if (c === "nearby" && typeof store.distanceKm === "number" && store.distanceKm < 3) s += SCORE_MOOD;
  }
  return s;
}

function distanceBonusKm(km: number | null | undefined): number {
  if (km == null || !Number.isFinite(km)) return 0;
  if (km <= 1.5) return SCORE_DISTANCE_MAX;
  if (km <= 3) return 4;
  if (km <= 7) return 2;
  if (km <= 15) return 1;
  return 0;
}

/** 매장명 직접 일치: 쿼리가 이름에 포함되면 강한 가산점 */
export function directNameMatchScore(query: string, storeName: string): number {
  const q = normCompact(query);
  const n = normCompact(storeName);
  if (!q || !n) return 0;
  if (n.includes(q)) return SCORE_NAME_DIRECT;
  const qTokens = normLoose(query)
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  let hit = 0;
  for (const t of qTokens) {
    if (normCompact(t).length >= 2 && n.includes(normCompact(t))) hit++;
  }
  return hit >= 2 ? Math.min(SCORE_NAME_DIRECT, hit * 12) : hit === 1 ? 20 : 0;
}

export function scoreStoreByIntent(
  store: StoreScoreInput,
  intent: ParsedSearchIntent,
  categoryNorm: CategoryAxis
): { score: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};
  let score = 0;

  if (intent.categories.length > 0) {
    if (intent.categories.includes(categoryNorm)) {
      b.category = SCORE_CATEGORY;
      score += SCORE_CATEGORY;
    }
  }

  const tagStr = (store.tags ?? []).join(" ");
  const moodStr = (store.mood ?? []).join(" ");
  const tagC = normCompact(tagStr);
  const moodC = normCompact(moodStr);

  const nameC = normCompact(store.name);
  for (const hint of intent.moodHints) {
    if (!hint) continue;
    if (moodC.includes(hint)) {
      b.mood_match = (b.mood_match ?? 0) + SCORE_MOOD;
      score += SCORE_MOOD;
    }
    if (tagC.includes(hint)) {
      b.tag_match = (b.tag_match ?? 0) + SCORE_TAG;
      score += SCORE_TAG;
    }
  }

  const addr = normCompact(`${store.address ?? ""} ${store.area ?? ""}`);
  for (const hint of intent.moodHints) {
    if (!hint) continue;
    const inName = nameC.includes(hint);
    const inAddr = addr.includes(hint);
    if ((inName || inAddr) && !moodC.includes(hint) && !tagC.includes(hint)) {
      b.text_partial = (b.text_partial ?? 0) + SCORE_TEXT;
      score += SCORE_TEXT;
    }
  }
  for (const term of intent.areaTerms) {
    const t = normCompact(term);
    if (t && addr.includes(t)) {
      b.area = (b.area ?? 0) + SCORE_TEXT;
      score += SCORE_TEXT;
    }
  }

  const cx = companionScore(store, intent);
  if (cx) b.companion = cx;
  score += cx;

  const cond = conditionScore(store, intent);
  if (cond) b.condition = cond;
  score += cond;

  const d = distanceBonusKm(store.distanceKm);
  if (d) b.distance = d;
  score += d;

  return { score, breakdown: b };
}

export function debugSearchIntent(
  query: string,
  intent: ParsedSearchIntent,
  samples: { id: string; name: string; score: number; breakdown: Record<string, number> }[]
): void {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") return;
  if (typeof window === "undefined") return;
  // eslint-disable-next-line no-console
  console.groupCollapsed("[HAMA intent search]", query);
  // eslint-disable-next-line no-console
  console.log("parsed intent:", JSON.stringify(intent, null, 2));
  // eslint-disable-next-line no-console
  console.table(samples.slice(0, 15));
  // eslint-disable-next-line no-console
  console.groupEnd();
}
