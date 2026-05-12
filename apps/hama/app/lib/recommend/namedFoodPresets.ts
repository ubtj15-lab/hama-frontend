import { normalizeBrandQuery } from "@/lib/results/placeNameSearchIntent";
import type { HomeCard } from "@/lib/storeTypes";

/**
 * 프리셋 내 서브 분기 (로깅용).
 * 오픈베타 전에는 중식을 `chinese_general`만 사용 — `jajangmyeon` / `jjamppong` 은 세부 프리셋 재도입 시 예약.
 */
export type NamedFoodSubIntent =
  | "default"
  | "jajangmyeon"
  | "jjamppong"
  | "chinese_general";

/** 세부 음식 프리셋 간 역방향 신호 패널티(재도입 시 사용 — 현재 중식 통합 프리셋에는 미사용) */
export type NamedFoodOppositePenalty = {
  oppositeFragments: readonly string[];
  /** name+메뉴 구역에 역방향이 있고 여기 포함된 신호가 없을 때 패널티 적용 */
  primaryWaiveFragments: readonly string[];
  penaltyOppositeInNameMenu: number;
  /** 역방향이 태그/무드에는 있으나 이름·메뉴 블롭에는 없음 */
  penaltyOppositeTagsOnly: number;
};

export type NamedFoodPreset = {
  id: string;
  label: string;
  /** 엄격 매칭용 (쿼리 매칭·카드 strict 단계 동일 소스) */
  keywords: readonly string[];
  /** strict 매칭 풀이 좁을 때만 restaurant 안에서 추가 허용 (다른 카테고리 채우기 금지) */
  broadKeywords?: readonly string[];
  subIntent?: NamedFoodSubIntent;
  /** 카페·베이커리·디저트 등 패턴에 걸리면 프리셋 후보 제외(restaurant 행이라도 표기 혼합 제거) */
  excludeCafeBakeryLikeText?: boolean;
  oppositeRankingPenalty?: NamedFoodOppositePenalty;
  /** broad만 일본식 신호 등으로 붙은 경우 랭크 상한을 낮춤 (돈까스 등) */
  capBoostWhenBroadOnly?: number;
};

/**
 * 오픈베타 전 보수 모드(정확도 최우선): 고기·갈비·닭갈비는 strict 미만 3장이면 억지 fallback 없이 부족 처리.
 * QA 권장: `고기`, `갈비`, `닭갈비` 검색은 이번 라인에서 제외하고, 그 외 검증된 세부 프리셋 쿼리 위주로 검증.
 */
export const CONSERVATIVE_ACCURACY_FIRST_PRESET_IDS = new Set<string>(["meat_bbq", "dakgalbi"]);

export function isConservativeAccuracyFirstFoodPreset(preset: NamedFoodPreset | null | undefined): boolean {
  return preset != null && CONSERVATIVE_ACCURACY_FIRST_PRESET_IDS.has(preset.id);
}

/** 카페·베이커리·브런치 패밀리 (이름/Blob 상 혼등 제거용) — 식당 DB인데 카페 전인 곳 배제 */
const CAFE_BAKERY_LIKE_REGEX =
  /(?:^|[^\p{L}\p{N}])(?:카페|음료|브런치|커피|베이커리|디저트|도넛|도넛츠|\bbakery\b|\bcafe\b|dessert|디저트(?:바|카페)?)(?:[^\p{L}\p{N}]|$)/iu;

export function blobFailsPresetCafeBakeryExclude(card: HomeCard): boolean {
  const blob = normalizeBlob(card);
  return CAFE_BAKERY_LIKE_REGEX.test(blob);
}

const NON_RESTAURANT_DB_CATEGORIES = new Set([
  "cafe",
  "ce7",
  "salon",
  "bk9",
  "beauty",
  "activity",
  "at4",
  "library",
  "museum",
  "culture",
  "gallery",
  "exhibition",
  "park",
]);

/** DB category가 식당 탭 매장만 허용(FD6/meal 포함). 카페·액티비티·라이브러리 등 즉시 제외 */
export function isNamedFoodPresetRestaurantDbCategoryOnly(card: HomeCard): boolean {
  const cat = String((card as { category?: string | null }).category ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "");
  if (!cat) return false;
  if (NON_RESTAURANT_DB_CATEGORIES.has(cat)) return false;
  if (cat.includes("cafe")) return false;
  if (cat.includes("salon") || cat.includes("beauty")) return false;
  if (cat.includes("activity")) return false;
  if (cat.includes("library")) return false;
  return (
    cat === "restaurant" ||
    cat === "fd6" ||
    cat === "meal" ||
    (cat.includes("food") && !cat.includes("cafe"))
  );
}

/**
 * 카테고리는 식당인데 실제로 놀이·도서관·키즈 카페인 경우(restaurant 코드 오등록) 걸러냄
 */
export function blobFailsNamedFoodPresetHardExclude(card: HomeCard): boolean {
  const blob = normalizeBlob(card);
  return /보드게임|방탈출|방\s*탈|이스케이프|escape\s*room|boardgame|board\s*game|도서관|\blibrary\b|헬스장|헬스클럽|수영장|키즈카페|방방이|\b공원\b|근린공원|영화관/i.test(
    blob
  );
}

/** 최종 UI 필터 — category 레이블 보조(DB 식당 + 라벨 키워드). */
export function passesNamedFoodPresetFinalRestaurantLabel(card: HomeCard): boolean {
  const catRaw = String((card as { category?: string | null }).category ?? "").toLowerCase();
  if (
    catRaw === "restaurant" ||
    catRaw === "fd6" ||
    catRaw === "meal" ||
    (catRaw.includes("food") && !catRaw.includes("cafe"))
  ) {
    return true;
  }
  const lab = `${String((card as { categoryLabel?: string | null }).categoryLabel ?? "")} `.toLowerCase();
  return /식당|음식점|외식|맛집|레스토랑|중식|한식|일식|양식|분식/.test(lab);
}

function nk(s: string): string {
  return normalizeBrandQuery(String(s ?? "")).trim().toLowerCase();
}

function nkList(words: readonly string[]): string[] {
  return [...words].map((w) => nk(w)).filter((f) => f.length >= 2);
}

/** 돈까스 strict/broad 결과가 빈 극소 데이터 지역 — 일식·일본요리 Blob 완화 게이트용 */
const TONKATSU_RELAX_JAPANESE_FRAGMENTS = nkList([
  "일식",
  "일식집",
  "일본식",
  "일본요리",
  "라멘",
  "우동",
  "소바",
  "규동",
  "이자카야",
  "야키토리",
  "데판야끼",
  "카츠동",
]);

/** 돈까스 전문 신호(이름·메뉴) — 있으면 초밥 패널티 면제 */
const TONKATSU_SPECIALIST_HINTS_IN_NAME_MENU = nkList([
  "돈까스",
  "돈가스",
  "카츠",
  "돈카츠",
  "히레카츠",
  "로스카츠",
  "치즈카츠",
  "가츠",
  "카츠동",
  "규카츠",
]);

const SUSHI_DOMINANT_IN_NAME_MENU = nkList([
  "초밥",
  "스시",
  "사시미",
  "횟집",
  "오마카세",
  "회전초밥",
  "스시바",
  "모둠회",
  "참치회",
  "연어회",
  "방어회",
  "연어스시",
  "참치스시",
]);

const SUSHI_HINTS_TAGS_OR_WIDE = nkList(["초밥", "스시", "사시미", "횟집", "오마카세", "연어", "회"]);

export const NAMED_FOOD_PRESETS: readonly NamedFoodPreset[] = [
  {
    id: "meat_bbq",
    label: "고기/고기집",
    keywords: [
      "고기",
      "고기집",
      "삼겹살",
      "갈비",
      "소갈비",
      "돼지갈비",
      "숯불",
      "바베큐",
      "bbq",
      "정육식당",
    ],
    broadKeywords: ["구이", "불고기", "정육", "육류", "한우", "목살", "돼지", "소고기", "숯불구이"],
  },
  {
    id: "dakgalbi",
    label: "닭갈비",
    keywords: ["닭갈비", "춘천닭갈비", "철판닭갈비"],
    broadKeywords: ["닭", "철판", "양념통닭"],
  },
  {
    id: "naengmyeon",
    label: "냉면/막국수",
    keywords: ["냉면", "물냉면", "비빔냉면", "막국수", "밀면"],
    broadKeywords: ["평양냉면", "함흥냉면", "냉모밀", "국수집"],
  },
  {
    id: "pho",
    label: "쌀국수",
    keywords: ["쌀국수", "베트남", "pho", "분짜", "반미"],
    broadKeywords: ["베트남음식", "쌀국", "vietnam"],
  },
  /**
   * 중식 통합 (오픈베타 전 안정화).
   * 짜장/짬뽕 세부 프리셋(`chinese_jajang`, `chinese_jjamppong`)은 DB 품질 이슈로 비활성화 — 아래 키워드는 모두 이 프리셋으로 매칭.
   * 오베 후 메뉴 데이터 보강 뒤 짜장면/짬뽕 세부 분리 재활성화 예정.
   *
   * 비활성화 시 복구용 블록(배열에서 별도 항목으로 되돌릴 것):
   * chinese_jjamppong / chinese_jajang + oppositeRankingPenalty …
   */
  {
    id: "chinese",
    label: "중식",
    keywords: [
      "해물짬뽕",
      "고기짬뽕",
      "짬뽕",
      "짜장면",
      "자장면",
      "짜장",
      "자장",
      "탕수육",
      "중국집",
      "중화요리",
      "중식당",
      "중식",
      "마라탕",
      "중화",
    ],
    broadKeywords: ["마라", "훠궈", "양꼬치", "딤섬", "중국음식"],
    subIntent: "chinese_general",
    /** 도서관/카페 등으로 오분류된 restaurant 행 배제 — 중식·짜장·짬뽕 등과 혼동되는 업종 억제 */
    excludeCafeBakeryLikeText: true,
  },
  {
    id: "pocha_bar",
    label: "포차/술집",
    keywords: ["포차", "술집", "이자카야", "호프", "주점", "펍", "맥주", "소주", "야식"],
    broadKeywords: ["안주", "포장마차", "감성주점"],
  },
  {
    id: "pasta_pizza",
    label: "파스타/이탈리안",
    keywords: ["파스타", "스파게티", "이탈리안", "리조또"],
    broadKeywords: ["피자", "양식", "레스토랑"],
    excludeCafeBakeryLikeText: true,
  },
  {
    id: "bunsik",
    label: "분식",
    keywords: ["분식", "떡볶이", "김밥", "순대", "라면", "튀김", "어묵"],
    broadKeywords: ["만두", "즉석떡볶이", "꼬마김밥"],
    excludeCafeBakeryLikeText: true,
  },
  {
    id: "gukbap",
    label: "국밥/해장국",
    keywords: ["국밥", "순대국", "해장국", "감자탕", "설렁탕", "곰탕"],
    broadKeywords: ["한우곰탕", "머리국밥"],
  },
  {
    id: "sushi_sashimi",
    label: "초밥/회",
    keywords: ["초밥", "스시", "회", "횟집", "사시미"],
    broadKeywords: ["참치", "사시미", "오마카세", "연어"],
  },
  {
    id: "chicken_ff",
    label: "치킨/피자/햄버거",
    keywords: ["치킨", "피자", "햄버거", "버거", "패스트푸드"],
    broadKeywords: ["통닭", "양념치킨", "후라이드"],
  },
];

export function presetSubIntentLabel(preset: NamedFoodPreset | null | undefined): string {
  return preset?.subIntent ?? "default";
}

function keywordTouchesQuery(queryNorm: string, kwNorm: string): boolean {
  if (!queryNorm || !kwNorm) return false;
  if (queryNorm === kwNorm) return true;
  if (kwNorm.length >= 3 && queryNorm.includes(kwNorm)) return true;
  if (queryNorm.length >= 3 && kwNorm.includes(queryNorm)) return true;
  if (kwNorm.length === 2 && queryNorm.includes(kwNorm)) return true;
  return false;
}

/**
 * 오픈베타 전: 돈까스 프리셋(`tonkatsu`) 비활성화 — 전문점·정확 매칭 데이터가 부족해 일식집 완화 추천을 막는다.
 * 재활성화 시: `false`로 두고 아래 주석의 tonkatsu 항목을 `NAMED_FOOD_PRESETS` 배열에 다시 넣는다.
 */
const TONKATSU_NAMED_PRESET_DISABLED_FOR_OPEN_BETA = true;
const SOLO_SITUATION_INTENT_FRAGMENTS = ["혼밥", "혼자", "혼자밥", "1인", "나혼자"] as const;

/** `NAMED_FOOD_PRESETS`에서 빠진 tonkatsu 정의(복구용). 오베 후 데이터 보강 시 배열에 복귀. */
// {
//   id: "tonkatsu",
//   label: "돈까스",
//   keywords: ["돈까스", "돈가스", "카츠", "돈카츠", "가츠"],
//   broadKeywords: ["일식", "일식집", "일본식", "라멘", "우동", "소바", "규동"],
//   capBoostWhenBroadOnly: 22,
// },

/** /results 등에서 추천 페치를 건너뛸 때 — `matchNamedFoodPreset`과 동일한 키워드 터치 규칙 */
export function matchesTonkatsuBetaDisabledQuery(rawQuery: string | null | undefined): boolean {
  if (!TONKATSU_NAMED_PRESET_DISABLED_FOR_OPEN_BETA) return false;
  const q = nk(rawQuery ?? "");
  if (!q) return false;
  for (const kw of ["돈까스", "돈가스", "카츠", "돈카츠", "가츠"] as const) {
    if (keywordTouchesQuery(q, nk(kw))) return true;
  }
  return false;
}

/**
 * 혼밥/혼자/1인 등 상황형 검색어 감지.
 * namedFoodPreset 매칭보다 먼저 검사해 상황 intent 흐름을 우선시한다.
 */
export function isSoloSituationIntentQuery(rawQuery: string | null | undefined): boolean {
  const q = nk(rawQuery ?? "");
  if (!q) return false;
  for (const frag of SOLO_SITUATION_INTENT_FRAGMENTS) {
    if (keywordTouchesQuery(q, nk(frag))) return true;
  }
  return false;
}

export function matchNamedFoodPreset(rawQuery: string | null | undefined): NamedFoodPreset | null {
  const q = nk(rawQuery ?? "");
  if (!q) return null;
  for (const preset of NAMED_FOOD_PRESETS) {
    const keywordsDesc = [...preset.keywords].sort((a, b) => b.length - a.length);
    for (const kw of keywordsDesc) {
      const k = nk(kw);
      if (keywordTouchesQuery(q, k)) return preset;
    }
  }
  return null;
}

export function presetKeywordFragments(preset: NamedFoodPreset, phase: "strict" | "broad"): string[] {
  const base = [...preset.keywords];
  const broad = [...(preset.broadKeywords ?? [])];
  const merged = phase === "strict" ? base : [...base, ...broad];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of merged) {
    const f = nk(k);
    if (!f || f.length < 2) continue;
    if (seen.has(f)) continue;
    seen.add(f);
    out.push(f);
  }
  return out.sort((a, b) => b.length - a.length);
}

export function normalizeBlob(card: HomeCard): string {
  const c = card as {
    name?: string | null;
    category?: string | null;
    categoryLabel?: string | null;
    description?: string | null;
    tags?: string[] | unknown;
    mood?: string[] | unknown;
    moodText?: string | null;
    menu_keywords?: string[] | unknown;
  };
  const tags = Array.isArray(c.tags) ? c.tags.join(" ") : String(c.tags ?? "");
  const mood = Array.isArray(c.mood) ? c.mood.join(" ") : String(c.mood ?? "");
  const menuKw = Array.isArray(c.menu_keywords)
    ? c.menu_keywords.join(" ")
    : String(c.menu_keywords ?? "");
  const parts = [
    String(c.name ?? ""),
    String(c.category ?? ""),
    String(c.categoryLabel ?? ""),
    String(c.description ?? ""),
    tags,
    mood,
    String(c.moodText ?? ""),
    menuKw,
  ];
  return ` ${parts.join(" ").toLowerCase().replace(/\s+/g, " ").trim()} `;
}

/** 전문점·메뉴 우선 랭킹용: 이름·설명·메뉴 키·카테고리 라벨 */
export function normalizeNameMenuBlob(card: HomeCard): string {
  const c = card as {
    name?: string | null;
    description?: string | null;
    menu_keywords?: string[] | unknown;
    categoryLabel?: string | null;
  };
  const menuKw = Array.isArray(c.menu_keywords)
    ? c.menu_keywords.join(" ")
    : String(c.menu_keywords ?? "");
  const parts = [String(c.name ?? ""), String(c.description ?? ""), menuKw, String(c.categoryLabel ?? "")];
  return ` ${parts.join(" ").toLowerCase().replace(/\s+/g, " ").trim()} `;
}

/** 태그·무드만 (strict가 여기에만 있을 때 낮은 티어) */
export function normalizeTagsMoodBlob(card: HomeCard): string {
  const c = card as { tags?: string[] | unknown; mood?: string[] | unknown; moodText?: string | null };
  const tags = Array.isArray(c.tags) ? c.tags.join(" ") : String(c.tags ?? "");
  const mood = Array.isArray(c.mood) ? c.mood.join(" ") : String(c.mood ?? "");
  const parts = [tags, mood, String(c.moodText ?? "")];
  return ` ${parts.join(" ").toLowerCase().replace(/\s+/g, " ").trim()} `;
}

/** 랭킹 strict 우선순위용: 순서대로 이름 → menu_keywords → tags → categoryLabel 전용 블롭 */
export function normalizeNameStrictBlob(card: HomeCard): string {
  const n = String((card as { name?: string | null }).name ?? "");
  return ` ${nk(n)} `.replace(/\s+/g, " ");
}

export function normalizeMenuKeywordsStrictBlob(card: HomeCard): string {
  const c = card as { menu_keywords?: string[] | unknown };
  const menuKw = Array.isArray(c.menu_keywords)
    ? c.menu_keywords.join(" ")
    : String(c.menu_keywords ?? "");
  return ` ${nk(menuKw)} `.replace(/\s+/g, " ");
}

export function normalizeTagsStrictBlob(card: HomeCard): string {
  const c = card as { tags?: string[] | unknown };
  const tags = Array.isArray(c.tags) ? c.tags.join(" ") : String(c.tags ?? "");
  return ` ${nk(tags)} `.replace(/\s+/g, " ");
}

export function normalizeCategoryLabelStrictBlob(card: HomeCard): string {
  const lab = String((card as { categoryLabel?: string | null }).categoryLabel ?? "");
  return ` ${nk(lab)} `.replace(/\s+/g, " ");
}

function touchesFragment(blob: string, frag: string): boolean {
  return frag.length >= 2 && blob.includes(frag);
}

/**
 * 돈까스 검색 후보 고갈 시: 레스토랑 한정 · 카페/키즈카페류 제외 후 일본/일식 식당 블롭만 허용.
 */
export function passesTonkatsuJapaneseRelaxGate(card: HomeCard): boolean {
  if (!isNamedFoodPresetRestaurantDbCategoryOnly(card)) return false;
  if (blobFailsNamedFoodPresetHardExclude(card)) return false;
  if (blobFailsPresetCafeBakeryExclude(card)) return false;
  const full = normalizeBlob(card);
  const lab = normalizeCategoryLabelStrictBlob(card);
  const labRaw = normalizeBrandQuery(String((card as { categoryLabel?: string | null }).categoryLabel ?? "").toLowerCase());
  if (/일본|일식/.test(labRaw)) return true;
  for (const f of TONKATSU_RELAX_JAPANESE_FRAGMENTS) {
    if (touchesFragment(full, f) || touchesFragment(lab, f)) return true;
  }
  return false;
}

function tonkatsuSushiDominantRankingPenalty(card: HomeCard, preset: NamedFoodPreset): number {
  if (preset.id !== "tonkatsu") return 0;
  const nameB = normalizeNameStrictBlob(card);
  const menuB = normalizeMenuKeywordsStrictBlob(card);
  const tagsB = normalizeTagsStrictBlob(card);

  const hasKatsuNm = TONKATSU_SPECIALIST_HINTS_IN_NAME_MENU.some(
    (f) => touchesFragment(nameB, f) || touchesFragment(menuB, f)
  );
  if (hasKatsuNm) return 0;

  const sushiStrongNm = SUSHI_DOMINANT_IN_NAME_MENU.some(
    (f) => touchesFragment(nameB, f) || touchesFragment(menuB, f)
  );
  if (sushiStrongNm) return -132;

  const sushiTagsOnly =
    !SUSHI_DOMINANT_IN_NAME_MENU.some((f) => touchesFragment(nameB, f) || touchesFragment(menuB, f)) &&
    SUSHI_HINTS_TAGS_OR_WIDE.some((f) => touchesFragment(tagsB, f));

  const full = normalizeBlob(card);
  const sushiOnlyInSecondary =
    sushiTagsOnly &&
    SUSHI_HINTS_TAGS_OR_WIDE.some((f) => touchesFragment(full, f) && !touchesFragment(nameB, f) && !touchesFragment(menuB, f));
  return sushiOnlyInSecondary ? -48 : sushiTagsOnly ? -38 : 0;
}

/** strict 키워드가 나타나는 가장 강한 필드: name>menu>tags>categoryLabel */
const T_STRICT_NONE = 0;
const T_STRICT_LABEL = 1;
const T_STRICT_TAGS = 2;
const T_STRICT_MENU = 3;
const T_STRICT_NAME = 4;

function strictKeywordBestFieldTier(
  frag: string,
  nameB: string,
  menuB: string,
  tagsB: string,
  labB: string
): number {
  if (touchesFragment(nameB, frag)) return T_STRICT_NAME;
  if (touchesFragment(menuB, frag)) return T_STRICT_MENU;
  if (touchesFragment(tagsB, frag)) return T_STRICT_TAGS;
  if (touchesFragment(labB, frag)) return T_STRICT_LABEL;
  return T_STRICT_NONE;
}

export function namedFoodPresetStrictPrioritySummary(
  card: HomeCard,
  preset: NamedFoodPreset
): { bestTier: number; strictKeywordHits: number } {
  const nameB = normalizeNameStrictBlob(card);
  const menuB = normalizeMenuKeywordsStrictBlob(card);
  const tagsB = normalizeTagsStrictBlob(card);
  const labB = normalizeCategoryLabelStrictBlob(card);
  let bestTier = T_STRICT_NONE;
  let strictKeywordHits = 0;
  const keys = [...preset.keywords].sort((a, b) => nk(b).length - nk(a).length);
  for (const kw of keys) {
    const f = nk(kw);
    if (f.length < 2) continue;
    const t = strictKeywordBestFieldTier(f, nameB, menuB, tagsB, labB);
    if (t !== T_STRICT_NONE) strictKeywordHits += 1;
    bestTier = Math.max(bestTier, t);
  }
  return { bestTier, strictKeywordHits };
}

/** 이름·메뉴키·태그·표시 카테고리 라벨 중 한 곳이라도 strict 키워드가 있으면 true (broad-only 제외) */
export function namedFoodPresetHasStrictInPriorityFields(card: HomeCard, preset: NamedFoodPreset): boolean {
  return namedFoodPresetStrictPrioritySummary(card, preset).bestTier > T_STRICT_NONE;
}

function compareNamedFoodRankRows<T extends { card: HomeCard; breakdown: { finalScore: number } }>(a: T, b: T): number {
  const d = b.breakdown.finalScore - a.breakdown.finalScore;
  if (Math.abs(d) > 1e-9) return d;
  return String(a.card.id ?? "").localeCompare(String(b.card.id ?? ""));
}

/**
 * strict(이름·메뉴·태그·라벨) 적중 매장을 broad-only보다 항상 앞에 둠 → top3에 broad-only는
 * strict 후보가 3곳 이상일 때 끼어들지 못함.
 */
export function reorderNamedFoodPresetRankingStrictPriority<
  T extends { card: HomeCard; breakdown: { finalScore: number } },
>(ranked: readonly T[], preset: NamedFoodPreset): T[] {
  const strict: T[] = [];
  const broadOnly: T[] = [];
  for (const row of ranked) {
    if (namedFoodPresetHasStrictInPriorityFields(row.card, preset)) strict.push(row);
    else broadOnly.push(row);
  }
  strict.sort(compareNamedFoodRankRows);
  broadOnly.sort(compareNamedFoodRankRows);
  return [...strict, ...broadOnly];
}

function oppositeRankingPenaltyBoost(card: HomeCard, preset: NamedFoodPreset): number {
  const cfg = preset.oppositeRankingPenalty;
  if (!cfg) return 0;
  const nm = normalizeNameMenuBlob(card);
  const tags = normalizeTagsMoodBlob(card);
  const full = normalizeBlob(card);
  const hasPrimaryNm = cfg.primaryWaiveFragments.some((f) => f.length >= 2 && touchesFragment(nm, f));
  if (hasPrimaryNm) return 0;
  const oppositeInNm = cfg.oppositeFragments.some((f) => f.length >= 2 && touchesFragment(nm, f));
  if (oppositeInNm) return -cfg.penaltyOppositeInNameMenu;
  const oppositeInTags = cfg.oppositeFragments.some((f) => f.length >= 2 && touchesFragment(tags, f));
  const oppositeInFull = cfg.oppositeFragments.some((f) => f.length >= 2 && touchesFragment(full, f));
  if (oppositeInTags || oppositeInFull) return -cfg.penaltyOppositeTagsOnly;
  return 0;
}

/**
 * strict 키워드 필드 티어(name > menu_keywords > tags > categoryLabel)를 압도적으로 반영.
 * broad-only(위 네 필드에 strict 없음)는 가점 상한이 매우 낮고, 덱 단계에서 strict 뒤로 재정렬됨.
 */
export function namedFoodPresetCompositeRankingBoost(card: HomeCard, preset: NamedFoodPreset): number {
  const { bestTier, strictKeywordHits } = namedFoodPresetStrictPrioritySummary(card, preset);
  const fullBlob = normalizeBlob(card);

  const broadList = [...(preset.broadKeywords ?? [])];
  const strictNormSet = new Set(preset.keywords.map((k) => nk(k)).filter((x) => x.length >= 2));
  const broadOnlyKws = broadList.filter((k) => !strictNormSet.has(nk(k)));
  let broadHitCount = 0;
  for (const kw of broadOnlyKws) {
    const f = nk(kw);
    if (f.length >= 2 && touchesFragment(fullBlob, f)) broadHitCount += 1;
  }

  const TIER_BASE: Record<number, number> = {
    [T_STRICT_NAME]: 292,
    [T_STRICT_MENU]: 208,
    [T_STRICT_TAGS]: 138,
    [T_STRICT_LABEL]: 84,
    [T_STRICT_NONE]: 11,
  };

  let boost = TIER_BASE[bestTier] ?? T_STRICT_NONE;

  if (bestTier > T_STRICT_NONE) {
    const extraStrict = Math.max(0, strictKeywordHits - 1);
    boost += Math.min(52, extraStrict * 17);
    const broadSynergyCap = bestTier >= T_STRICT_MENU ? 20 : 26;
    boost += Math.min(broadSynergyCap, broadHitCount * (bestTier >= T_STRICT_MENU ? 4 : 6));
  } else {
    boost += Math.min(12, broadHitCount * 5);
    if (preset.capBoostWhenBroadOnly != null) {
      boost = Math.min(boost, preset.capBoostWhenBroadOnly);
    }
  }

  boost += oppositeRankingPenaltyBoost(card, preset);
  boost += tonkatsuSushiDominantRankingPenalty(card, preset);

  return Math.min(420, Math.max(-185, boost));
}

/** @deprecated — composite 사용 권장. 하위 호환용 얇은 래핑 */
export function namedFoodPresetMatchBoost(card: HomeCard, preset: NamedFoodPreset, _maxBoost = 18): number {
  void _maxBoost;
  return namedFoodPresetCompositeRankingBoost(card, preset);
}

export function matchesNamedFoodPresetKeywords(card: HomeCard, preset: NamedFoodPreset, phase: "strict" | "broad"): boolean {
  const blob = normalizeBlob(card);
  for (const frag of presetKeywordFragments(preset, phase)) {
    if (frag.length >= 2 && blob.includes(frag)) return true;
  }
  return false;
}

export function passesNamedFoodPresetFullCardGate(
  card: HomeCard,
  preset: NamedFoodPreset,
  phase: "strict" | "broad"
): boolean {
  if (!isNamedFoodPresetRestaurantDbCategoryOnly(card)) return false;
  if (blobFailsNamedFoodPresetHardExclude(card)) return false;
  if (preset.excludeCafeBakeryLikeText && blobFailsPresetCafeBakeryExclude(card)) return false;
  return matchesNamedFoodPresetKeywords(card, preset, phase);
}

export function restaurantRowMatchesNamedFoodPreset(card: HomeCard, preset: NamedFoodPreset): boolean {
  return passesNamedFoodPresetFullCardGate(card, preset, "strict") || passesNamedFoodPresetFullCardGate(card, preset, "broad");
}

/** 같은 프리셋 내 카드 간 분리용: 이름→메뉴→태그→라벨→나머지 순으로 가장 긴 조각 */
export function namedFoodPresetCardSubBucket(card: HomeCard, preset: NamedFoodPreset): string {
  const nameB = normalizeNameStrictBlob(card);
  const menuB = normalizeMenuKeywordsStrictBlob(card);
  const tagsB = normalizeTagsStrictBlob(card);
  const labB = normalizeCategoryLabelStrictBlob(card);
  const fullBlob = normalizeBlob(card);

  const tryKeys = [...preset.keywords, ...(preset.broadKeywords ?? [])].sort((a, b) => nk(b).length - nk(a).length);
  for (const kw of tryKeys) {
    const fragment = nk(kw);
    if (fragment.length < 2) continue;
    if (touchesFragment(nameB, fragment)) return `nm:${fragment}`;
    if (touchesFragment(menuB, fragment)) return `menu:${fragment}`;
    if (touchesFragment(tagsB, fragment)) return `tag:${fragment}`;
    if (touchesFragment(labB, fragment)) return `lab:${fragment}`;
    if (touchesFragment(fullBlob, fragment)) return fragment;
  }
  return "__generic__";
}
