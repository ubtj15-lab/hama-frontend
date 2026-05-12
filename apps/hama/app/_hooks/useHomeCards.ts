"use client";

import { useEffect, useMemo, useState } from "react";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import {
  fetchCultureStoresByNameHintsChained,
  fetchEmergencySimpleCardsByCategories,
  homeCardMatchesScenarioBeautySalonBlock,
  fetchHomeCardsByTab,
  fetchHomeCardsByStoreCategories,
  fetchHomeCourseCandidatePool,
  fetchHomeRecommendCandidates,
  fetchRestaurantOnlyFoodPresetCards,
  toHomeCard,
  type StoreRow,
} from "@/lib/storeRepository";
import type { IntentionType } from "@/lib/intention";
import { buildTopRecommendations } from "@/lib/recommend/scoring";
import type { RecommendScoreBreakdown, ScoredRecommendItem } from "@/lib/recommend/scoring";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { intentCategoryToHomeTab } from "@/lib/scenarioEngine/intentClassification";
import { RECOMMEND_DECK_SIZE, RECOMMEND_POOL_SINGLE_TAB } from "@/lib/recommend/recommendConstants";
import { parseUserProfile, type UserProfile } from "@/lib/onboardingProfile";
import { explicitCategoryToFetchTab } from "@/lib/homeResultsNavParams";
import { normalizeBrandQuery } from "@/lib/results/placeNameSearchIntent";
import { isAlcoholNightlifeVenue } from "@/lib/recommend/childFriendlyScore";
import {
  bumpAndReadSearchAttemptForQuery,
  commitNamedFoodTop1Streak,
  getCardExposureId,
  getRecentExposureRotationSignature,
  readNamedFoodPrevTop3Fingerprint,
  readRecentExposedStoreIds,
  readNamedFoodTop1Streak,
  saveRecentExposedStoreIds,
  writeNamedFoodPrevTop3Fingerprint,
} from "@/lib/recommend/recentExposure";
import { logEvent } from "@/lib/logEvent";
import { getOrCreateHamaSearchSeed } from "@/lib/searchDiversityClient";
import { categoriesForHomeTab } from "@/lib/storeCategoryFilters";
import {
  applyStoreSuppression,
  fetchActiveStoreSuppressionRules,
  inferStoreSuppressionScope,
} from "@/lib/recommend/storeSuppression";
import { applyReasonTemplateEngine } from "@/lib/recommend/reasonTemplateEngine";
import { hamaDevLog } from "@/lib/hamaDevLog";
import {
  namedFoodPresetCompositeRankingBoost,
  namedFoodPresetCardSubBucket,
  presetSubIntentLabel,
  reorderNamedFoodPresetRankingStrictPriority,
  blobFailsNamedFoodPresetHardExclude,
  isNamedFoodPresetRestaurantDbCategoryOnly,
  matchesNamedFoodPresetKeywords,
  passesNamedFoodPresetFinalRestaurantLabel,
  passesNamedFoodPresetFullCardGate,
  isConservativeAccuracyFirstFoodPreset,
  passesTonkatsuJapaneseRelaxGate,
  matchNamedFoodPreset,
  isSoloSituationIntentQuery as textMatchesSoloSituationIntent,
  type NamedFoodPreset,
} from "@/lib/recommend/namedFoodPresets";

const KIDS_FAMILY_QUERY_KEYWORDS = [
  "아이",
  "아이랑",
  "애기",
  "아기",
  "유아",
  "초등",
  "어린이",
  "키즈",
  "가족",
  "가족외식",
  "가족 나들이",
] as const;

const UNSAFE_FOR_KIDS_KEYWORDS = [
  "포차",
  "술집",
  "호프",
  "이자카야",
  " pub ",
  "펍",
  "주점",
  "야식주점",
  "감성주점",
  "와인바",
  "칵테일",
  "라운지",
  "노래주점",
  "룸",
  "성인",
  "19금",
  " bar ",
] as const;

const UNSAFE_FOR_KIDS_FOOD_KEYWORDS = ["횟집", "회 ", "활어", "숙성회"] as const;

const FAST_FOOD_BRANDS = [
  "맥도날드",
  "맥도날도",
  "mcdonald",
  "롯데리아",
  "버거킹",
  "kfc",
  "맘스터치",
  "써브웨이",
  "서브웨이",
  "피자헛",
  "도미노",
  "미스터피자",
  "배스킨라빈스",
  "던킨",
] as const;

const RESTAURANT_DIAG_TARGET_QUERIES = new Set([
  "푸드",
  "식당",
  "맛집",
  "가족 외식",
  "아이랑 밥",
]);

const SITUATION_QUERY_PRESETS: Record<
  string,
  { categories: string[]; keywords: string[] }
> = {
  문화생활: {
    categories: ["activity", "library"],
    keywords: ["문화", "박물관", "전시", "미술관", "역사관", "도서관", "체험"],
  },
  데이트: {
    categories: ["cafe", "restaurant", "activity"],
    keywords: ["카페", "디저트", "레스토랑", "산책", "분위기", "브런치"],
  },
  "아이랑 갈만한 곳": {
    categories: ["activity", "library", "cafe", "restaurant"],
    keywords: ["아이", "가족", "키즈", "공원", "도서관", "체험", "실내"],
  },
  "비오는날 실내": {
    categories: ["cafe", "library", "activity"],
    keywords: ["실내", "카페", "도서관", "박물관", "전시", "키즈", "체험"],
  },
};

function isRestaurantDiagTargetQuery(q: string | null | undefined): boolean {
  const t = normalizeBrandQuery(String(q ?? "")).trim();
  return RESTAURANT_DIAG_TARGET_QUERIES.has(t);
}

function getSituationQueryPreset(q: string | null | undefined): { categories: string[]; keywords: string[] } | null {
  const t = normalizeBrandQuery(String(q ?? "")).trim();
  return SITUATION_QUERY_PRESETS[t] ?? null;
}

/** 응급 fetch category — salon/bk9는 storeRepository에서 추가로 제거함 */
function getResultsEmergencyFallbackCategories(q: string | null | undefined): string[] | null {
  const t = normalizeBrandQuery(String(q ?? "")).trim();
  if (!t) return null;
  if (t === "데이트") return ["cafe", "restaurant", "activity"];
  if (t === "비오는날 실내") return ["cafe", "library", "activity"];
  if (t === "아이랑 갈만한 곳") return ["activity", "library", "cafe", "restaurant"];
  if (t.includes("아이랑") || t.includes("가족")) return ["activity", "library", "cafe", "restaurant"];
  if (t.includes("비오는날") || t.includes("실내")) return ["cafe", "library", "activity"];
  if (t === "문화생활") return ["activity", "library"];
  return null;
}

function shouldBlockBeautySalonForListedScenarioQueries(q: string | null | undefined): boolean {
  const t = normalizeBrandQuery(String(q ?? "")).trim();
  if (!t) return false;
  return (
    t === "데이트" ||
    t.includes("아이랑") ||
    t.includes("가족") ||
    t.includes("실내") ||
    t.includes("비오는날")
  );
}

function isCultureLifestyleQuery(q: string | null | undefined): boolean {
  const t = normalizeBrandQuery(String(q ?? "")).trim();
  return t === "문화생활";
}

function isKidsFamilyLikeQuery(q: string | null | undefined): boolean {
  return /아이|아이랑|가족|키즈/.test(normalizeBrandQuery(String(q ?? "")));
}

function isNightlifeAdultTone(card: HomeCard): boolean {
  const b = normalizeBlob(card);
  return includesAny(b, [
    "술",
    "주점",
    "포차",
    "이자카야",
    "호프",
    "유흥",
    "클럽",
    "심야",
    "새벽",
    "라운지",
    "칵테일",
    "와인바",
    " bar ",
  ]);
}

function cultureLifestylePriorityScore(card: HomeCard, query: string | null | undefined): number {
  const b = normalizeBlob(card);
  const cat = categoryOf(card);
  const rawCat = String((card as any)?.category ?? "").toLowerCase();
  let score = 0;
  if (cat === "activity") score += 130;
  if (rawCat === "library") score += 120;
  if (isCultureLike(card) || hasCultureAnchor(card)) score += 95;
  if (isCafeLike(card)) score += 18; // 카페는 보조
  if (isRestaurantLike(card) || isFoodLike(card)) score -= 140; // 일반 식당 최하위
  if (includesAny(b, ["박물관", "전시", "미술관", "도서관", "공연", "체험", "공방", "보드게임", "실내", "문화"])) {
    score += 60;
  }
  if (includesAny(b, ["보드게임", "boardgame"])) score += 28;
  if (isKidsFamilyLikeQuery(query) && includesAny(b, ["보드게임", "boardgame"]) && isNightlifeAdultTone(card)) {
    score -= 85;
  }
  return score;
}

function applyCultureLifestyleTop3Guard(params: {
  selected: ScoredRecommendItem[];
  candidates: ScoredRecommendItem[];
  query: string | null | undefined;
}): ScoredRecommendItem[] {
  const { selected, candidates, query } = params;
  if (!isCultureLifestyleQuery(query)) return selected;
  const merged = mergeUniqueById(selected, candidates);
  if (merged.length === 0) return selected;
  const ranked = [...merged].sort((a, b) => {
    const sa = cultureLifestylePriorityScore(a.card, query);
    const sb = cultureLifestylePriorityScore(b.card, query);
    if (sa !== sb) return sb - sa;
    return hashString(`${a.card.id}|culture_lifestyle`) - hashString(`${b.card.id}|culture_lifestyle`);
  });
  const used = new Set<string>();
  const out: ScoredRecommendItem[] = [];
  const nonRestaurant = ranked.filter((x) => !isRestaurantLike(x.card) && !isFoodLike(x.card));
  // 문화생활 top3는 일반 식당을 배제
  for (const item of nonRestaurant) {
    if (out.length >= Math.min(3, RECOMMEND_DECK_SIZE)) break;
    if (used.has(item.card.id)) continue;
    out.push(item);
    used.add(item.card.id);
  }
  for (const item of ranked) {
    if (out.length >= RECOMMEND_DECK_SIZE) break;
    if (used.has(item.card.id)) continue;
    out.push(item);
    used.add(item.card.id);
  }
  return out;
}

type DiversityBucket =
  | "park"
  | "library"
  | "museum"
  | "boardgame"
  | "cafe"
  | "restaurant"
  | "kids"
  | "beauty";

function getDiversityBucket(card: HomeCard): DiversityBucket {
  const b = normalizeBlob(card);
  if (includesAny(b, ["공원", "산책", "둘레길"])) return "park";
  if (includesAny(b, ["도서관", "library"])) return "library";
  if (includesAny(b, ["박물관", "전시", "미술관", "역사관", "gallery", "museum"])) return "museum";
  if (includesAny(b, ["보드게임", "boardgame"])) return "boardgame";
  if (isBeautyLike(card) || includesAny(b, ["미용실", "헤어", "살롱"])) return "beauty";
  if (includesAny(b, ["키즈", "체험", "놀이터", "어린이"])) return "kids";
  if (isCafeLike(card) || includesAny(b, ["카페", "커피", "디저트"])) return "cafe";
  if (isRestaurantLike(card) || includesAny(b, ["식당", "음식", "밥", "맛집"])) return "restaurant";
  return "kids";
}

function pickFirstMatching(
  pool: ScoredRecommendItem[],
  usedIds: Set<string>,
  usedBuckets: Set<DiversityBucket>,
  buckets: DiversityBucket[],
  allowUsedBucket = false
): ScoredRecommendItem | null {
  for (const item of pool) {
    if (usedIds.has(item.card.id)) continue;
    const bucket = getDiversityBucket(item.card);
    if (!buckets.includes(bucket)) continue;
    if (!allowUsedBucket && usedBuckets.has(bucket)) continue;
    return item;
  }
  return null;
}

function applyBucketDiversityToPicked(
  selected: ScoredRecommendItem[],
  query: string | null | undefined,
  opts?: { deckTarget?: number; namedFoodPreset?: NamedFoodPreset | null }
): ScoredRecommendItem[] {
  if (selected.length < 2) return selected;
  const t = normalizeBrandQuery(String(query ?? "")).trim();
  const target = Math.min(opts?.deckTarget ?? RECOMMEND_DECK_SIZE, selected.length);
  const foodPreset = opts?.namedFoodPreset ?? null;
  const usedIds = new Set<string>();
  const usedBuckets = new Set<DiversityBucket>();
  const usedFoodPresetSubs = new Set<string>();
  const out: ScoredRecommendItem[] = [];

  const add = (item: ScoredRecommendItem | null) => {
    if (!item) return;
    if (usedIds.has(item.card.id)) return;
    out.push(item);
    usedIds.add(item.card.id);
    usedBuckets.add(getDiversityBucket(item.card));
  };

  if (t === "문화생활") {
    add(pickFirstMatching(selected, usedIds, usedBuckets, ["museum", "library", "park", "kids"]));
    add(pickFirstMatching(selected, usedIds, usedBuckets, ["boardgame", "kids", "museum", "library"]));
    add(pickFirstMatching(selected, usedIds, usedBuckets, ["cafe", "kids", "museum", "library", "park"]));
  } else if (isKidsFamilyLikeQuery(t)) {
    add(pickFirstMatching(selected, usedIds, usedBuckets, ["park"]));
    add(pickFirstMatching(selected, usedIds, usedBuckets, ["kids", "boardgame", "library", "museum"]));
    add(pickFirstMatching(selected, usedIds, usedBuckets, ["cafe", "restaurant"]));
  }

  // 공통: 같은 bucket(또는 음식 프리셋 서브버킷) 최대 1개 우선
  for (const item of selected) {
    if (out.length >= target) break;
    if (usedIds.has(item.card.id)) continue;
    if (foodPreset && (isRestaurantLike(item.card) || isFoodLike(item.card))) {
      const sub = namedFoodPresetCardSubBucket(item.card, foodPreset);
      if (usedFoodPresetSubs.has(sub)) continue;
      out.push(item);
      usedIds.add(item.card.id);
      usedFoodPresetSubs.add(sub);
      continue;
    }
    const bucket = getDiversityBucket(item.card);
    if (usedBuckets.has(bucket)) continue;
    out.push(item);
    usedIds.add(item.card.id);
    usedBuckets.add(bucket);
  }

  // 3개 미만이면 중복 bucket 허용
  if (out.length < 3) {
    for (const item of selected) {
      if (out.length >= Math.min(3, target)) break;
      if (usedIds.has(item.card.id)) continue;
      out.push(item);
      usedIds.add(item.card.id);
    }
  }

  for (const item of selected) {
    if (out.length >= target) break;
    if (usedIds.has(item.card.id)) continue;
    out.push(item);
    usedIds.add(item.card.id);
  }
  return out;
}

function shuffleCardsBySeed(cards: HomeCard[], seedText: string): HomeCard[] {
  if (cards.length < 2) return cards;
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let rng = h >>> 0;
  const next = () => {
    rng = (rng * 1103515245 + 12345) >>> 0;
    return rng;
  };
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = next() % (i + 1);
    const t = out[i]!;
    out[i] = out[j]!;
    out[j] = t;
  }
  return out;
}

/** 최근 노출 id 정렬용 감점(클수록 뒤로). */
function recentExposureSortPenalty(exposureId: string, recentOrdered: string[]): number {
  if (!exposureId) return 0;
  const idx = recentOrdered.indexOf(exposureId);
  if (idx < 0) return 0;
  return Math.min(360, 88 + idx * 16);
}

function shuffleScoredItemsBySeed(items: ScoredRecommendItem[], seedText: string): ScoredRecommendItem[] {
  if (items.length < 2) return items;
  const shuffledCards = shuffleCardsBySeed(
    items.map((x) => x.card),
    seedText
  );
  const byId = new Map(items.map((x) => [x.card.id, x] as const));
  return shuffledCards.map((c) => byId.get(c.id)).filter((x): x is ScoredRecommendItem => x != null);
}

function normalizeBlob(card: HomeCard): string {
  const c = card as any;
  const menuKw = Array.isArray(c?.menu_keywords)
    ? c.menu_keywords.join(" ")
    : String(c?.menu_keywords ?? "");
  const parts = [
    String(c?.name ?? ""),
    String(c?.category ?? ""),
    String(c?.categoryLabel ?? ""),
    String(c?.description ?? ""),
    Array.isArray(c?.tags) ? c.tags.join(" ") : String(c?.tags ?? ""),
    Array.isArray(c?.mood) ? c.mood.join(" ") : String(c?.mood ?? ""),
    String(c?.moodText ?? ""),
    menuKw,
  ];
  return ` ${parts.join(" ").toLowerCase().replace(/\s+/g, " ").trim()} `;
}

/** 데이트 단독 검색에서는 술집·야외 공원 차단 규칙을 쓰지 않음 */
function isDateOnlySituationSearchQuery(query: string | null | undefined): boolean {
  return normalizeBrandQuery(String(query ?? "")).trim() === "데이트";
}

/** 아이/가족/키즈 상황 — 포차·술집 등 제외 */
function scenarioQueryNeedsKidsNightlifeSafetyStrip(
  query: string | null | undefined,
  scenario: ScenarioObject | null | undefined
): boolean {
  if (isDateOnlySituationSearchQuery(query)) return false;
  const intent = detectIntentFit(query ?? null, scenario ?? null);
  if (
    intent === "kids_outing" ||
    intent === "kids_meal" ||
    intent === "family_dining" ||
    intent === "kids_cafe"
  ) {
    return true;
  }
  const t = normalizeBrandQuery(String(query ?? "")).trim();
  if (!t) return false;
  return (
    t.includes("아이랑") ||
    t.includes("가족") ||
    t.includes("키즈") ||
    /유아|어린이|영유아|초등|아기/.test(t) ||
    isKidsFamilyIntent(query, scenario ?? null)
  );
}

/** 비오는 날 · 실내 상황 — 야외 공원·산책 후보 축소(실내 면허 키워드는 예외) */
function scenarioQueryNeedsRainyIndoorOutdoorStrip(query: string | null | undefined): boolean {
  if (isDateOnlySituationSearchQuery(query)) return false;
  const t = normalizeBrandQuery(String(query ?? "")).trim();
  if (!t) return false;
  return t.includes("비오는날") || t.includes("실내");
}

const SCENARIO_KIDS_NIGHT_TOKENS = [
  "포차",
  "술집",
  "이자카야",
  "호프",
  "주점",
  "펍",
  "소주",
  "맥주",
  "와인바",
  "야식포차",
] as const;

function cardMatchesKidsScenarioNightExclude(card: HomeCard): boolean {
  const blob = normalizeBlob(card);
  if (includesAny(blob, [...SCENARIO_KIDS_NIGHT_TOKENS])) return true;
  if (blob.includes(` 바 `)) return true;
  if (blob.includes(` 펍 `) || /\sbar\s/.test(blob) || /\sbeer\s|\swine\b/.test(blob))
    return true;
  const rawCat = String((card as any)?.category ?? "").toLowerCase().replace(/\s+/g, "");
  if (rawCat.includes("pub") || rawCat.includes("bar")) return true;
  return false;
}

const RAIN_INDOOR_ALLOW_SUBSTRINGS = [
  "실내체육관",
  "실내놀이터",
  "키즈카페",
  "박물관",
  "도서관",
  "전시관",
] as const;

const RAIN_OUTDOOR_PARK_SUBSTRINGS = ["소공원", "산책로", "산책", "놀이터", "체육공원", "광장", "공원", "야외", "운동장"] as const;

function cardMatchesRainyOutdoorParkExclude(card: HomeCard): boolean {
  const blob = normalizeBlob(card);
  for (const ok of RAIN_INDOOR_ALLOW_SUBSTRINGS) {
    if (blob.includes(ok)) return false;
  }
  return includesAny(blob, [...RAIN_OUTDOOR_PARK_SUBSTRINGS]);
}

function shouldRemoveHomeCardForScenarioSafety(
  card: HomeCard,
  query: string | null | undefined,
  scenario: ScenarioObject | null | undefined,
  opts: { kids: boolean; rain: boolean }
): boolean {
  void query;
  void scenario;
  if (opts.kids && cardMatchesKidsScenarioNightExclude(card)) return true;
  if (opts.rain && cardMatchesRainyOutdoorParkExclude(card)) return true;
  return false;
}

function filterHomeCardsForScenarioSafety(
  cards: HomeCard[],
  query: string | null | undefined,
  scenario: ScenarioObject | null | undefined
): HomeCard[] {
  const kids = scenarioQueryNeedsKidsNightlifeSafetyStrip(query, scenario);
  const rain = scenarioQueryNeedsRainyIndoorOutdoorStrip(query);
  if (!kids && !rain) return cards;
  return cards.filter((c) => !shouldRemoveHomeCardForScenarioSafety(c, query, scenario, { kids, rain }));
}

function stripScenarioSafetyFromScoredRecommendDeck(
  deck: ScoredRecommendItem[],
  query: string | null | undefined,
  scenario: ScenarioObject | null | undefined
): { deck: ScoredRecommendItem[]; removedNames: string[] } {
  const kids = scenarioQueryNeedsKidsNightlifeSafetyStrip(query, scenario);
  const rain = scenarioQueryNeedsRainyIndoorOutdoorStrip(query);
  if (!kids && !rain) return { deck, removedNames: [] };
  const removedNames: string[] = [];
  const next = deck.filter((item) => {
    if (shouldRemoveHomeCardForScenarioSafety(item.card, query, scenario, { kids, rain })) {
      removedNames.push(item.card.name);
      return false;
    }
    return true;
  });
  return { deck: next, removedNames };
}

function filterScoredRecommendItemsForScenarioSafety(
  items: ScoredRecommendItem[],
  query: string | null | undefined,
  scenario: ScenarioObject | null | undefined
): ScoredRecommendItem[] {
  const kids = scenarioQueryNeedsKidsNightlifeSafetyStrip(query, scenario);
  const rain = scenarioQueryNeedsRainyIndoorOutdoorStrip(query);
  if (!kids && !rain) return items;
  return items.filter(
    (it) => !shouldRemoveHomeCardForScenarioSafety(it.card, query, scenario, { kids, rain })
  );
}

function isKidsFamilyIntent(query: string | null | undefined, scenario: ScenarioObject | null | undefined): boolean {
  const q = String(query ?? "").toLowerCase();
  if (KIDS_FAMILY_QUERY_KEYWORDS.some((kw) => q.includes(kw))) return true;
  const scenarioBlob = `${String(scenario?.scenario ?? "")} ${String(scenario?.rawQuery ?? "")}`.toLowerCase();
  if (/kids|family|아이|가족|키즈/.test(scenarioBlob)) return true;
  const comps = Array.isArray((scenario as any)?.companions) ? ((scenario as any).companions as string[]) : [];
  return comps.includes("아이") || comps.includes("가족");
}

type IntentFit =
  | "none"
  | "kids_outing"
  | "kids_meal"
  | "family_dining"
  | "kids_cafe"
  | "cafe_general"
  | "date_social";

const INTENT_PATTERNS: Record<Exclude<IntentFit, "none">, RegExp[]> = {
  kids_outing: [
    /아이랑\s*갈\s*곳/,
    /아이랑\s*어디/,
    /아이랑\s*놀/,
    /아이랑\s*가기/,
    /키즈/,
    /아이랑\s*나들이/,
    /가족\s*나들이/,
  ],
  kids_meal: [
    /아이랑\s*밥/,
    /아이랑\s*식사/,
    /아이랑\s*먹/,
    /아이랑\s*외식/,
    /가족\s*밥/,
    /가족\s*식사/,
  ],
  family_dining: [
    /가족\s*외식/,
    /가족\s*식사/,
    /가족이랑\s*밥/,
    /가족이랑\s*식사/,
    /가족이랑\s*외식/,
    /가족하고\s*외식/,
    /가족하고\s*밥/,
    /가족끼리\s*외식/,
    /가족끼리\s*밥/,
    /외식\s*어디/,
    /외식\s*추천/,
    /부모님\s*식사/,
    /부모님이랑\s*식사/,
    /부모님\s*모시고/,
    /가족\s*모임/,
    /가족\s*식당/,
    /외식할\s*곳/,
  ],
  kids_cafe: [
    /아이랑\s*카페/,
    /키즈\s*카페/,
    /아이랑\s*커피/,
    /아이랑\s*디저트/,
  ],
  cafe_general: [
    /카페/,
    /커피/,
    /디저트/,
    /브런치/,
  ],
  date_social: [/데이트/, /연인/, /커플/],
};

function detectIntentFit(query: string | null | undefined, scenario: ScenarioObject | null | undefined): IntentFit {
  const text = `${String(query ?? "")} ${String(scenario?.rawQuery ?? "")}`.toLowerCase();
  if (INTENT_PATTERNS.kids_cafe.some((re) => re.test(text))) return "kids_cafe";
  if (INTENT_PATTERNS.kids_meal.some((re) => re.test(text))) return "kids_meal";
  if (INTENT_PATTERNS.family_dining.some((re) => re.test(text))) return "family_dining";
  if (INTENT_PATTERNS.kids_outing.some((re) => re.test(text))) return "kids_outing";
  if (INTENT_PATTERNS.date_social.some((re) => re.test(text))) return "date_social";
  if (INTENT_PATTERNS.cafe_general.some((re) => re.test(text))) return "cafe_general";
  return "none";
}

function categoryOf(card: HomeCard): "restaurant" | "cafe" | "activity" | "salon" | "other" {
  const c = String((card as any)?.category ?? "").toLowerCase();
  if (c === "restaurant" || c === "fd6" || c === "meal" || c.includes("food") || c.includes("식당"))
    return "restaurant";
  if (c === "cafe" || c === "ce7" || c.includes("카페")) return "cafe";
  if (c === "activity" || c === "at4" || c.includes("액티")) return "activity";
  if (c === "salon" || c === "bk9" || c.includes("미용")) return "salon";
  return "other";
}

function includesAny(blob: string, words: string[]): boolean {
  return words.some((w) => blob.includes(w));
}

function isRestaurantLike(card: HomeCard): boolean {
  const blob = normalizeBlob(card);
  if (categoryOf(card) === "restaurant") return true;
  return includesAny(blob, [
    "식당",
    "음식점",
    "한식",
    "고기",
    "갈비",
    "샤브",
    "국수",
    "칼국수",
    "돈까스",
    "분식",
    "중식",
    "일식",
    "백반",
    "외식",
    "식사",
    "김밥",
    "수육",
    "횟집",
    "국밥",
    "파스타",
    "닭갈비",
    "숯불",
    "구이",
    "뷔페",
    "찜",
    "탕",
    "해장국",
    "냉면",
    "만두",
  ]);
}

/** 식당·음식점 계열(명시 카테고리 게이트용 — FD6/맛집/음식점 blob 포함) */
function isFoodLike(card: HomeCard): boolean {
  if (isRestaurantLike(card)) return true;
  const raw = String((card as any)?.category ?? "").toLowerCase();
  if (raw === "fd6" || raw === "meal" || raw.includes("fd6") || raw.includes("food")) return true;
  const blob = normalizeBlob(card);
  return includesAny(blob, ["맛집", "음식점", "레스토랑", "restaurant", "food"]);
}

function isCafeLike(card: HomeCard): boolean {
  const blob = normalizeBlob(card);
  const raw = String((card as any)?.category ?? "").toLowerCase();
  if (categoryOf(card) === "cafe") return true;
  if (raw === "ce7" || raw.includes("ce7") || raw.includes("coffee") || raw.includes("dessert") || raw.includes("bakery"))
    return true;
  return includesAny(blob, [
    "카페",
    "커피",
    "coffee",
    "브런치",
    "라떼",
    "아메리카노",
    "디저트",
    "베이커리",
    "bakery",
    "케이크",
    "빵",
    "tea",
    "티",
    "음료",
  ]);
}

function isBeautyLike(card: HomeCard): boolean {
  const blob = normalizeBlob(card);
  const raw = String((card as any)?.category ?? "").toLowerCase();
  if (categoryOf(card) === "salon") return true;
  if (raw === "bk9" || raw === "beauty" || raw.includes("salon") || raw.includes("beauty")) return true;
  return includesAny(blob, ["미용실", "헤어", "네일", "뷰티", "관리", "왁싱", "살롱", "헤어샵"]);
}

/** beauty_hair — 살롱·BK9 등은 텍스트 없어도 허용, 네일·속눈썹 전문은 헤어 풀이 넉넉할 때 후순위 */
function isBeautyHairPreferredCandidate(card: HomeCard): boolean {
  if (!isBeautyLike(card)) return false;
  const raw = String((card as any)?.category ?? "").toLowerCase();
  if (raw === "salon" || raw === "bk9" || raw === "beauty" || raw.includes("salon") || raw.includes("bk9")) return true;
  const b = normalizeBlob(card);
  if (/네일|nail\s*art|nailart/.test(b) && !/헤어|hair|미용실|살롱|커트|컷|펌|염색|두피|클리닉/.test(b)) return false;
  if (/(속눈썹|래쉬|lash|제모|왁싱|waxing)/.test(b) && !/헤어|hair|미용실|살롱/.test(b)) return false;
  return true;
}

function isActivityLike(card: HomeCard): boolean {
  const blob = normalizeBlob(card);
  if (categoryOf(card) === "activity") return true;
  return includesAny(blob, ["체험", "놀이", "공원", "산책", "키즈", "보드게임", "방탈출", "전시"]);
}

function isDessertLike(card: HomeCard): boolean {
  const blob = normalizeBlob(card);
  return includesAny(blob, ["디저트", "베이커리", "케이크", "고로케", "와플"]);
}

/** URL `explicitCategory=life` — 생활 편의·의료 등(양성 키워드) */
function isLifeLike(card: HomeCard): boolean {
  const b = normalizeBlob(card);
  const raw = String((card as any)?.category ?? "").toLowerCase();
  if (includesAny(b, ["동물병원", "수의과"])) return true;
  return includesAny(b, [
    "병원",
    "종합병원",
    "의원",
    "치과",
    "내과",
    "소아과",
    "약국",
    "드럭스토어",
    "세탁",
    "크리닝",
    "laundry",
    "편의점",
    "마트",
    "슈퍼마켓",
    "이마트",
    "롯데마트",
    "홈플러스",
    "코스트코",
    "생활편의",
    "공공시설",
    "주차장",
    "주차",
    "은행",
    "우체국",
    "수리",
    "a/s",
    " as ",
    "에이에스",
    "생활서비스",
    "생활 서비스",
    "편의서비스",
  ]);
}

/** URL `explicitCategory=culture` — 전시·공연·도서 등 (activity 행이어도 이름/태그에 문화 키워드면 허용) */
function isCultureLike(card: HomeCard): boolean {
  const b = normalizeBlob(card);
  const raw = String((card as any)?.category ?? "").toLowerCase();
  if (
    (raw === "activity" || raw === "at4" || raw.includes("activity")) &&
    includesAny(b, [
      "박물관",
      "미술관",
      "전시관",
      "전시",
      "도서관",
      "문화",
      "과학관",
      "기념관",
      "역사",
      "갤러리",
      "아트",
      "체험관",
      "museum",
      "gallery",
      "library",
      "exhibition",
    ])
  ) {
    return true;
  }
  if (
    /museum|culture|library|gallery|exhibition|theater|theatre|cinema|bookstore/.test(raw) ||
    /박물관|미술관|전시관|도서관|문화원|문화의집|공연장|영화관|극장|과학관|기념관|서점|도서|역사/.test(raw)
  ) {
    return true;
  }
  return includesAny(b, [
    "전시",
    "공연",
    "영화",
    "책방",
    "도서관",
    "박물관",
    "미술관",
    "문화센터",
    "체험관",
    "갤러리",
    "서점",
    "공연장",
    "극장",
    "전시관",
    "아트센터",
    "연극",
    "뮤지컬",
    "문화",
    "영화관",
    "아트",
    "역사",
    "과학관",
    "기념관",
    "문화재",
    "도서",
    "독서",
    "콘서트",
  ]);
}

/** URL `explicitCategory=fitness` — 운동·체육 시설 */
function isFitnessLike(card: HomeCard): boolean {
  const b = normalizeBlob(card);
  const raw = String((card as any)?.category ?? "").toLowerCase();
  if (raw.includes("fitness") || raw.includes("gym")) return true;
  return includesAny(b, [
    "헬스",
    "필라테스",
    "요가",
    "수영",
    "수영장",
    "pt",
    "퍼스널트레이닝",
    "스포츠",
    "체육관",
    "운동",
    "골프",
    "클라이밍",
    "댄스",
    "복싱",
    "태권도",
    "gym",
    "fitness",
    "pilates",
    "yoga",
    "크로스핏",
    "trx",
  ]);
}

function isUnmannedCafe(card: HomeCard): boolean {
  const blob = normalizeBlob(card);
  return includesAny(blob, ["무인카페", "무인", "테이크아웃", "takeout", "테이크아웃전문"]);
}

function isFastFood(card: HomeCard): boolean {
  return detectFastFoodBrand(card) != null;
}

function getSessionSeed(): string {
  if (typeof window === "undefined") return "no_window";
  try {
    const key = "hama_rec_shuffle_seed";
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return "no_session";
  }
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 1000;
}

function mergeHomeCardsUniqueById(a: HomeCard[], b: HomeCard[]): HomeCard[] {
  const seen = new Set<string>();
  const out: HomeCard[] = [];
  for (const arr of [a, b]) {
    for (const c of arr) {
      const id = String((c as any)?.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(c);
    }
  }
  return out;
}

/** 검색창 직접 "박물관"과 동일한 `/api/stores/search-by-name` 원천 */
async function fetchMuseumCardsViaSearchByNameApi(q: string): Promise<HomeCard[]> {
  try {
    const t = String(q ?? "").trim();
    if (t.length < 2) return [];
    const url = `/api/stores/search-by-name?${new URLSearchParams({ q: t }).toString()}`;
    const seed = getOrCreateHamaSearchSeed();
    const headers: Record<string, string> = {};
    if (seed) headers["x-hama-search-seed"] = seed;
    const res = await fetch(url, {
      cache: "no-store",
      headers: Object.keys(headers).length ? headers : undefined,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: StoreRow[] };
    return (json.items ?? []).map((row) => toHomeCard(row));
  } catch {
    return [];
  }
}

/** 명시 카테고리 탐색용 — strict 랭킹/덱이 비었을 때만 사용 */
function neutralBrowseBreakdown(finalScore: number): RecommendScoreBreakdown {
  const s = Math.max(0, Math.min(100, Math.round(finalScore)));
  return {
    distanceScore: s,
    scenarioScore: s,
    businessScore: s,
    qualityScore: s,
    keywordScore: s,
    bonusScore: 0,
    foodIntentScore: 0,
    compositeScore: 0,
    scenarioRaw: 0,
    scenarioRichScore: s,
    convenienceScore: s,
    behaviorBoostPillar: 0,
    behaviorVisibility: 1,
    personalizationScore: s,
    finalScore: s,
    businessState: "UNKNOWN",
    activeScenario: "solo",
  };
}

function homeCardToBrowseScoredItem(card: HomeCard, finalScore: number): ScoredRecommendItem {
  return {
    card: { ...card },
    reasonText: "카테고리 탐색",
    reasonVoice: "solo",
    breakdown: neutralBrowseBreakdown(finalScore),
  };
}

function cafeBrowseTier(card: HomeCard): number {
  if (isUnmannedCafe(card)) return 2;
  const blob = normalizeBlob(card);
  const sweetOnly =
    (isDessertLike(card) || includesAny(blob, ["베이커리", "케이크", "빵"])) &&
    !includesAny(blob, ["카페", "커피", "coffee", "라떼", "아메리카노", "브런치", "americano", "latte", "cafe"]);
  if (sweetOnly) return 1;
  return 0;
}

function sortCardsForCafeBrowse(pool: HomeCard[]): HomeCard[] {
  return [...pool].sort((a, b) => {
    const ta = cafeBrowseTier(a);
    const tb = cafeBrowseTier(b);
    if (ta !== tb) return ta - tb;
    return hashString(`${a.id}|cafe`) - hashString(`${b.id}|cafe`);
  });
}

function beautyBrowseTier(card: HomeCard, hairIntent: boolean): number {
  if (!hairIntent) return 0;
  const b = normalizeBlob(card);
  if (/네일|nail\s*art|nailart|속눈썹|래쉬|lash|제모|왁싱|waxing/.test(b) && !/헤어|hair|미용실|살롱|커트|컷|펌|염색|두피|클리닉/.test(b))
    return 2;
  if (/두피|클리닉/.test(b)) return 1;
  if (/미용실|헤어|헤어샵|살롱|커트|컷|펌|염색/.test(b)) return 0;
  if (isBeautyHairPreferredCandidate(card)) return 0;
  return 1;
}

function sortCardsForBeautyBrowse(pool: HomeCard[], hairIntent: boolean): HomeCard[] {
  return [...pool].sort((a, b) => {
    const ta = beautyBrowseTier(a, hairIntent);
    const tb = beautyBrowseTier(b, hairIntent);
    if (ta !== tb) return ta - tb;
    return hashString(`${a.id}|beauty`) - hashString(`${b.id}|beauty`);
  });
}

function cultureBrowseTier(card: HomeCard): number {
  const b = normalizeBlob(card);
  if (/박물관|미술관|전시관|과학관|기념관/.test(b)) return 0;
  if (/도서관|문화센터|갤러리|gallery/.test(b)) return 1;
  if (/공연|영화|극장|콘서트|뮤지컬|영화관/.test(b)) return 2;
  return 1;
}

/** 이름·태그·설명 blob 기준 문화 앵커 — explicit culture 게이트·browse 구제 공통 */
function hasCultureAnchor(card: HomeCard): boolean {
  const b = normalizeBlob(card);
  return /박물관|미술관|전시관|과학관|기념관|도서관|기록매체박물관|문화의|문화센터|문화|역사|갤러리|전시장|전시|museum|gallery|library|exhibition/i.test(
    b
  );
}

function cultureBrowseBlobHint(card: HomeCard): boolean {
  return hasCultureAnchor(card);
}

function cultureBrowseHardBlocked(card: HomeCard): boolean {
  if (isCafeLike(card)) return true;
  if (isBeautyLike(card)) return true;
  if (isFitnessLike(card)) return true;
  if (isDessertLike(card) && !cultureBrowseBlobHint(card)) return true;
  if ((isRestaurantLike(card) || isFoodLike(card)) && !cultureBrowseBlobHint(card)) return true;
  return false;
}

/** 이름 힌트 전용 구제 — cultureBrowseFilter보다 완화(앵커만으로 덱 구성) */
function cultureRescueSoftBlock(card: HomeCard): boolean {
  if (isCafeLike(card)) return true;
  if (isBeautyLike(card)) return true;
  if (isFitnessLike(card)) return true;
  if (isDessertLike(card) && !hasCultureAnchor(card)) return true;
  if ((isRestaurantLike(card) || isFoodLike(card)) && !hasCultureAnchor(card)) return true;
  return false;
}

/** 문화 탐색 덱 — isCultureLike 또는 문화 키워드 blob; 식당/카페/뷰티/운동은 제외(이름에 문화 앵커 있으면 activity 등 허용) */
function cultureBrowseFilter(cards: HomeCard[]): HomeCard[] {
  return cards.filter((c) => {
    if (cultureBrowseHardBlocked(c)) return false;
    return isCultureLike(c) || cultureBrowseBlobHint(c);
  });
}

function sortCardsForCultureBrowse(pool: HomeCard[]): HomeCard[] {
  return [...pool].sort((a, b) => {
    const ta = cultureBrowseTier(a);
    const tb = cultureBrowseTier(b);
    if (ta !== tb) return ta - tb;
    return hashString(`${a.id}|culture`) - hashString(`${b.id}|culture`);
  });
}

/** 박물관·도서관·미술관 등: 상위 20개 내 2~n순위 위주 시드 셔플(1순위는 흔들지 않음, 가끔 1↔2) */
function isCultureLibraryMuseumDiversityQuery(q: string | null | undefined): boolean {
  const t = normalizeBrandQuery(String(q ?? "")).trim();
  return ["박물관", "미술관", "도서관", "전시관", "과학관", "기념관"].includes(t);
}

function cultureLibraryMuseumDiverseShuffle(
  cards: HomeCard[],
  seedKey: string,
  queryLabel: string
): HomeCard[] {
  const sorted = sortCardsForCultureBrowse(cards);
  const poolLen = sorted.length;
  if (poolLen < 4) return sorted;
  const n = Math.min(20, poolLen);
  const head = sorted.slice(0, n);
  let seed = hashString(`${seedKey}|${getSessionSeed()}|culdiv`);
  const nextRand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed;
  };
  const beforeTop10 = head.slice(0, 10).map((c) => c.name);
  const tailPart = head.slice(2);
  const swapN = Math.min(32, Math.max(8, tailPart.length * 5));
  for (let k = 0; k < swapN; k++) {
    if (tailPart.length < 2) break;
    const i = nextRand() % tailPart.length;
    const j = nextRand() % tailPart.length;
    if (i !== j) {
      const t = tailPart[i]!;
      tailPart[i] = tailPart[j]!;
      tailPart[j] = t;
    }
  }
  const outHead: HomeCard[] =
    head[0] && head[1] ? [head[0]!, head[1]!, ...tailPart] : [...head];
  if (outHead.length >= 2 && (nextRand() % 25) === 0) {
    const tmp = outHead[0]!;
    outHead[0] = outHead[1]!;
    outHead[1] = tmp;
  }
  const afterTop10 = outHead.slice(0, 10).map((c) => c.name);
  console.log("[culture/library/museum diversity]", {
    query: queryLabel,
    seed: getSessionSeed(),
    poolSize: poolLen,
    beforeTop10,
    afterTop10,
    selectedTop5: outHead.slice(0, 5).map((c) => c.name),
  });
  return [...outHead, ...sorted.slice(n)];
}

function buildCategoryBrowseScoredDeck(sortedCards: HomeCard[]): ScoredRecommendItem[] {
  const n = Math.min(RECOMMEND_DECK_SIZE, sortedCards.length);
  const base = 72;
  return sortedCards.slice(0, n).map((card, i) => homeCardToBrowseScoredItem(card, base - i * 4));
}

/** URL beauty_* 일 때 랭킹에서 세부 서브만 과도하게 감점되지 않도록(살롱·BK9는 텍스트 없어도 허용) */
function scenarioForHomeCardsRanking(
  so: ScenarioObject | null | undefined,
  explicitIntent: string | null | undefined
): ScenarioObject | null | undefined {
  if (!so) return so;
  const ei = (explicitIntent ?? "").trim().toLowerCase();
  if (ei.startsWith("beauty_")) {
    return { ...so, beautySubCategory: undefined };
  }
  return so;
}

function shouldShuffleExplicitFoodPool(options: {
  explicitCategory?: string | null;
  explicitIntent?: string | null;
  scenarioObject?: ScenarioObject | null;
}): boolean {
  const ex = (options.explicitCategory ?? "").trim().toLowerCase();
  const ei = (options.explicitIntent ?? "").trim().toLowerCase();
  if (ex === "restaurant" || ei === "food_general") return true;
  const so = options.scenarioObject;
  if (so?.intentType === "search_strict" && so.intentCategory === "FOOD") return true;
  return false;
}

function cuisineDiversityBucket(card: HomeCard): string {
  const b = normalizeBlob(card);
  if (/뷔페|buffet|무한리필/.test(b)) return "buffet";
  if (/중식|짜장|짬뽕|탕수육/.test(b)) return "chinese";
  if (/국수|칼국수|우동|라멘|초밥|회|일식|돈까스/.test(b)) return "japanese_noodle";
  if (/한식|백반|국밥|한우|갈비|삼겹|고기집/.test(b)) return "korean_meat";
  if (/양식|파스타|스테이크|피자|브런치/.test(b)) return "western";
  if (/분식|떡볶이|김밥|순대/.test(b)) return "bunsik";
  if (/순대국|설렁탕|감자탕/.test(b)) return "korean_soup";
  return "other";
}

function shuffleFoodRestaurantTopSlice(
  ranked: ScoredRecommendItem[],
  seedParts: { q: string | null; explicitCategory: string | null; explicitIntent: string | null }
): { list: ScoredRecommendItem[]; beforeSliceNames: string[]; afterSliceNames: string[] } {
  const isRest = (it: ScoredRecommendItem) => {
    const co = categoryOf(it.card);
    return co === "restaurant" || isRestaurantLike(it.card) || isFoodLike(it.card);
  };
  const restSorted = ranked.filter(isRest).sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore);
  const topN = restSorted.slice(0, 30);
  if (topN.length <= 1) {
    return {
      list: ranked,
      beforeSliceNames: ranked.slice(0, 3).map((x) => x.card.name),
      afterSliceNames: ranked.slice(0, 3).map((x) => x.card.name),
    };
  }
  const day = new Date().toISOString().slice(0, 10);
  let seed = hashString(
    `${seedParts.q ?? ""}|${seedParts.explicitCategory ?? ""}|${seedParts.explicitIntent ?? ""}|${day}|${getSessionSeed()}`
  );

  const pool = topN.map((it) => ({ it, bucket: cuisineDiversityBucket(it.card) }));
  const picked: ScoredRecommendItem[] = [];
  const work = [...pool];
  const bucketCounts = new Map<string, number>();
  while (work.length && picked.length < topN.length) {
    let bestI = 0;
    let bestEff = -Infinity;
    for (let i = 0; i < work.length; i++) {
      const { it, bucket } = work[i]!;
      const bc = bucketCounts.get(bucket) ?? 0;
      seed = (seed * 1103515245 + 12345) >>> 0;
      const jitter = (seed % 997) / 5000;
      const eff = it.breakdown.finalScore + jitter - bc * 9;
      if (eff > bestEff) {
        bestEff = eff;
        bestI = i;
      }
    }
    const ch = work.splice(bestI, 1)[0]!;
    picked.push(ch.it);
    bucketCounts.set(ch.bucket, (bucketCounts.get(ch.bucket) ?? 0) + 1);
  }

  const shuffledTop = picked;
  const topIds = new Set(shuffledTop.map((x) => x.card.id));
  const tail = ranked.filter((x) => !topIds.has(x.card.id));
  const list = [...shuffledTop, ...tail];
  return {
    list,
    beforeSliceNames: restSorted.slice(0, 3).map((x) => x.card.name),
    afterSliceNames: shuffledTop.slice(0, 3).map((x) => x.card.name),
  };
}

function intentFitDelta(intentFit: IntentFit, card: HomeCard): number {
  if (intentFit === "none") return 0;
  const blob = normalizeBlob(card);
  const cat = categoryOf(card);
  const fastFood = detectFastFoodBrand(card) != null;
  let score = 0;

  if (intentFit === "kids_outing") {
    if (cat === "activity") score += 55;
    if (cat === "restaurant") score += 8;
    if (cat === "cafe") score -= 10;
    if (fastFood) score -= 22;
    if (
      includesAny(blob, ["키즈", "아이", "어린이", "체험", "놀이", "공원", "산책", "보드게임", "키즈카페", "넓은", "주차", "가족"])
    ) {
      score += 18;
    }
  } else if (intentFit === "kids_meal") {
    if (cat === "restaurant") score += 58;
    if (cat === "cafe") score -= 28;
    if (cat === "activity") score -= 20;
    if (fastFood) score -= 34;
    if (
      includesAny(blob, ["한식", "분식", "돈까스", "샤브", "가족", "아이동반", "주차", "넓은", "좌석", "식사", "외식"])
    ) {
      score += 20;
    }
  } else if (intentFit === "family_dining") {
    if (cat === "restaurant") score += 62;
    if (cat === "cafe") score -= 64;
    if (cat === "activity") score -= 24;
    if (fastFood) score -= 48;
    if (includesAny(blob, ["디저트", "베이커리", "케이크", "커피", "무인카페"])) score -= 40;
    if (
      includesAny(blob, ["가족외식", "가족 식사", "한식", "고기", "샤브", "넓은", "룸", "주차", "부모님", "단체", "좌석"])
    ) {
      score += 22;
    }
  } else if (intentFit === "kids_cafe") {
    if (cat === "cafe") score += 50;
    if (cat === "restaurant") score += 5;
    if (cat === "activity") score -= 12;
    if (fastFood) score -= 20;
    if (includesAny(blob, ["키즈", "아이", "가족", "넓은", "디저트", "브런치", "주차", "유모차", "좌석"])) {
      score += 16;
    }
    if (includesAny(blob, ["무인카페", "무인", "테이크아웃", "takeout", "테이크아웃전문"])) {
      score -= 45;
    }
  } else if (intentFit === "cafe_general") {
    if (isCafeLike(card)) score += 45;
    if (isDessertLike(card)) score += 10;
    if (isUnmannedCafe(card)) score -= 30;
    if (!isCafeLike(card) && isRestaurantLike(card)) score -= 20;
  } else if (intentFit === "date_social") {
    return 0;
  }
  return score;
}

function isGenericFoodCategorySearchQuery(q: string | null | undefined): boolean {
  const t = normalizeBrandQuery(String(q ?? "")).trim();
  return t === "푸드" || t === "식당" || t === "맛집";
}

function detectFastFoodBrand(card: HomeCard): string | null {
  const blob = normalizeBlob(card);
  for (const brand of FAST_FOOD_BRANDS) {
    if (blob.includes(brand.toLowerCase())) return brand;
  }
  return null;
}

/** 푸드/식당/맛집 browse·가드에서 카페·문화·뷰티·라이프 등 혼입 방지 */
function isGenericFoodExcludedVenue(card: HomeCard): boolean {
  if (isCafeLike(card)) return true;
  if (isDessertLike(card)) return true;
  if (isBeautyLike(card)) return true;
  if (isCultureLike(card)) return true;
  if (isFitnessLike(card)) return true;
  if (isLifeLike(card)) return true;
  return false;
}

const GENERIC_FOOD_WIDE_MATCH = new RegExp(
  [
    "식당",
    "음식점",
    "한식",
    "중식",
    "일식",
    "분식",
    "김밥",
    "국수",
    "칼국수",
    "수육",
    "고기",
    "갈비",
    "샤브",
    "돈까스",
    "횟집",
    "회",
    "백반",
    "국밥",
    "파스타",
    "닭갈비",
    "숯불",
    "구이",
    "뷔페",
    "찜",
    "탕",
    "해장국",
    "냉면",
    "만두",
  ].join("|"),
  "i"
);

function hasGenericFoodWideKeyword(card: HomeCard): boolean {
  return GENERIC_FOOD_WIDE_MATCH.test(normalizeBlob(card));
}

function isMealRestaurantCategory(card: HomeCard): boolean {
  const c = String((card as any)?.category ?? "").toLowerCase();
  return c === "restaurant" || c === "fd6" || c === "meal" || c === "food" || c.includes("fd6");
}

function isGenericFoodBrowsePoolRow(card: HomeCard): boolean {
  if (isGenericFoodExcludedVenue(card)) return false;
  if (isMealRestaurantCategory(card)) return true;
  if (hasGenericFoodWideKeyword(card)) return true;
  if (isRestaurantLike(card)) return true;
  if (isFoodLike(card)) return true;
  return false;
}

function sortGenericFoodBrowseStable(cards: HomeCard[], seedKey: string): HomeCard[] {
  return [...cards].sort((a, b) => hashString(`${seedKey}|${a.id}`) - hashString(`${seedKey}|${b.id}`));
}

/** browse recovery: non–fast-food 우선, non이 없으면 키워드·카테고리로만 넓힌 비패스트푸드; 그래도 없으면 빈 배열 */
function composeGenericFoodOrderedCards(pool: HomeCard[], seedKey: string): HomeCard[] {
  const rows = mergeHomeCardsUniqueById(pool, []);
  const inPool = rows.filter(isGenericFoodBrowsePoolRow);
  const non: HomeCard[] = [];
  const ff: HomeCard[] = [];
  for (const c of inPool) {
    if (detectFastFoodBrand(c)) ff.push(c);
    else non.push(c);
  }

  const widenNonFastFromRows = (): HomeCard[] => {
    const out: HomeCard[] = [];
    const seen = new Set<string>();
    for (const c of rows) {
      if (isGenericFoodExcludedVenue(c)) continue;
      if (detectFastFoodBrand(c)) continue;
      if (!hasGenericFoodWideKeyword(c) && !isMealRestaurantCategory(c) && !isRestaurantLike(c)) continue;
      const id = String((c as any)?.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(c);
    }
    return out;
  };

  let nonFf = non;
  if (nonFf.length === 0) {
    nonFf = widenNonFastFromRows();
  }

  const nonSorted = sortGenericFoodBrowseStable(nonFf, `${seedKey}|non`);
  const ffSorted = sortGenericFoodBrowseStable(ff, `${seedKey}|ff`);

  if (nonSorted.length === 0) return [];

  if (nonSorted.length >= 3) {
    return nonSorted.slice(0, 40);
  }
  return [...nonSorted, ...ffSorted].slice(0, 40);
}

function genericFoodTop3AllFastFood(picked: ScoredRecommendItem[]): boolean {
  const t3 = picked.slice(0, Math.min(3, picked.length));
  return t3.length > 0 && t3.every((x) => detectFastFoodBrand(x.card));
}

/** 패밀리 외식 final 3에서 제외할 체인·라이프스타일 (이름/카테고리/태그 blob) */
function isFamilyDiningChainOrSnackBanned(card: HomeCard): boolean {
  const b = normalizeBlob(card);
  return includesAny(b, [
    "kfc",
    "메가",
    "mgc",
    "투썸",
    "twosome",
    "이디야",
    "ediya",
    "텐퍼센트",
    "10%",
    "ten percent",
  ]);
}

function isFamilyDiningFinalSlotBanned(card: HomeCard): boolean {
  if (isAlcoholNightlifeVenue(card)) return true;
  if (isCafeLike(card)) return true;
  if (isBeautyLike(card)) return true;
  if (isActivityLike(card)) return true;
  if (isDessertLike(card)) return true;
  if (isUnmannedCafe(card)) return true;
  if (isFastFood(card)) return true;
  if (isFamilyDiningChainOrSnackBanned(card)) return true;
  const b = normalizeBlob(card);
  if (includesAny(b, ["츄러스", "고로케"])) return true;
  return false;
}

/** family_dining: 식사 위주 후보 (final에서 카페·체인·패스트푸드 제외) */
function isFamilyDiningMealVenue(card: HomeCard): boolean {
  if (isFamilyDiningFinalSlotBanned(card)) return false;
  return isRestaurantLike(card) || categoryOf(card) === "restaurant";
}

function isKidsOutingFinalBanned(card: HomeCard): boolean {
  if (isAlcoholNightlifeVenue(card)) return true;
  if (isBeautyLike(card)) return true;
  const b = normalizeBlob(card);
  if (includesAny(b, ["헤어", "네일", "미용실", "hair", "nail"])) return true;
  if (isFastFood(card)) return true;
  return false;
}

/** kids_outing: 보드게임·키즈·체험 등 활동 우선 */
function isKidsOutingStrongActivity(card: HomeCard): boolean {
  const b = normalizeBlob(card);
  if (categoryOf(card) === "activity") return true;
  if (isActivityLike(card)) return true;
  return includesAny(b, [
    "보드게임",
    "방탈출",
    "키즈카페",
    "키즈",
    "체험",
    "공원",
    "전시",
    "히어로",
    "vr",
    "만화카페",
    "놀이터",
  ]);
}

function mergeUniqueById(a: ScoredRecommendItem[], b: ScoredRecommendItem[]): ScoredRecommendItem[] {
  const seen = new Set<string>();
  const out: ScoredRecommendItem[] = [];
  for (const arr of [a, b]) {
    for (const item of arr) {
      if (seen.has(item.card.id)) continue;
      seen.add(item.card.id);
      out.push(item);
    }
  }
  return out;
}

type FinalDeckConstraintResult = {
  selected: ScoredRecommendItem[];
  removedByFinalConstraint: string[];
  restaurantLikeCount: number;
  activityLikeCount: number;
};

/** 보조/폴백에서 final 덱에 절대 넣지 않을 후보 (final 이후 재진입 방지용) */
function isBlockedByFinalDeckIntent(detectedIntent: IntentFit, card: HomeCard): boolean {
  if (detectedIntent === "family_dining") return isFamilyDiningFinalSlotBanned(card);
  if (detectedIntent === "kids_outing") return isKidsOutingFinalBanned(card);
  if (detectedIntent === "kids_meal") return isAlcoholNightlifeVenue(card);
  if (detectedIntent === "kids_cafe") return isAlcoholNightlifeVenue(card);
  return false;
}

function applyFinalDeckConstraint(params: {
  detectedIntent: IntentFit;
  selected: ScoredRecommendItem[];
  candidates: ScoredRecommendItem[];
  source: ScoredRecommendItem[];
  removedByGateIds: Set<string>;
  unsafeIds: Set<string>;
  kidsFamily: boolean;
  deckSize: number;
}): FinalDeckConstraintResult {
  const {
    detectedIntent,
    selected: before,
    candidates,
    source,
    removedByGateIds,
    unsafeIds,
    kidsFamily,
    deckSize,
  } = params;

  const restaurantLikeCount = candidates.filter((x) => isRestaurantLike(x.card)).length;
  const activityLikeCount = candidates.filter((x) => isActivityLike(x.card)).length;

  const isItemBaseExcluded = (item: ScoredRecommendItem) =>
    removedByGateIds.has(item.card.id) ||
    unsafeIds.has(item.card.id) ||
    (kidsFamily && isUnsafeForKids(item.card));

  const removedNames: string[] = [];

  const eligibleFromOrdered = (ordered: ScoredRecommendItem[], pred: (c: HomeCard) => boolean): ScoredRecommendItem[] => {
    const out: ScoredRecommendItem[] = [];
    const seen = new Set<string>();
    for (const item of ordered) {
      if (seen.has(item.card.id)) continue;
      if (isItemBaseExcluded(item)) continue;
      if (!pred(item.card)) continue;
      seen.add(item.card.id);
      out.push(item);
    }
    return out;
  };

  let next: ScoredRecommendItem[] = [];

  if (detectedIntent === "family_dining") {
    const mealOrdered = eligibleFromOrdered(candidates, (c) => isFamilyDiningMealVenue(c));
    if (mealOrdered.length >= 3) {
      next = mealOrdered.slice(0, deckSize);
    } else if (mealOrdered.length === 2) {
      const pickedIds = new Set(mealOrdered.map((x) => x.card.id));
      const aux = mergeUniqueById(candidates, source).find(
        (x) => !pickedIds.has(x.card.id) && !isItemBaseExcluded(x) && !isFamilyDiningFinalSlotBanned(x.card)
      );
      next = aux ? [...mealOrdered, aux] : [...mealOrdered];
    } else {
      const pool = eligibleFromOrdered(mergeUniqueById(candidates, source), (c) => !isFamilyDiningFinalSlotBanned(c));
      next = pool.slice(0, deckSize);
    }
  } else if (detectedIntent === "kids_outing") {
    const poolRaw = mergeUniqueById(candidates, source).filter((x) => !isItemBaseExcluded(x) && !isKidsOutingFinalBanned(x.card));
    const strongExists = poolRaw.some((x) => isKidsOutingStrongActivity(x.card));
    const tier = (x: ScoredRecommendItem) => {
      if (isKidsOutingStrongActivity(x.card)) return 0;
      if (categoryOf(x.card) === "activity") return 1;
      if (isRestaurantLike(x.card) || isCafeLike(x.card)) return strongExists ? 2 : 1;
      return strongExists ? 3 : 2;
    };
    const sorted = [...poolRaw].sort((a, b) => {
      const d = tier(a) - tier(b);
      if (d !== 0) return d;
      return poolRaw.indexOf(a) - poolRaw.indexOf(b);
    });
    next = sorted.slice(0, deckSize);
  } else if (detectedIntent === "kids_meal") {
    const restInPool = candidates.filter((x) => isRestaurantLike(x.card)).length;
    const allowCafeEtc = restInPool < 2;
    const pool = mergeUniqueById(candidates, source).filter(
      (x) =>
        !isItemBaseExcluded(x) &&
        !isBeautyLike(x.card) &&
        !isActivityLike(x.card) &&
        !isAlcoholNightlifeVenue(x.card)
    );
    const out: ScoredRecommendItem[] = [];
    let fastFoodSlots = 0;
    const used = new Set<string>();
    const tryPush = (item: ScoredRecommendItem): boolean => {
      if (used.has(item.card.id)) return false;
      const ff = isFastFood(item.card);
      if (out.length === 0 && ff) return false;
      if (ff && fastFoodSlots >= 1) return false;
      const nonMeal = isCafeLike(item.card) || isBeautyLike(item.card) || isActivityLike(item.card);
      if (nonMeal && !allowCafeEtc && out.filter((x) => isRestaurantLike(x.card)).length < 2) return false;
      if (nonMeal && !allowCafeEtc && !isRestaurantLike(item.card)) return false;
      used.add(item.card.id);
      if (ff) fastFoodSlots += 1;
      out.push(item);
      return true;
    };
    const pri = [...pool].sort((a, b) => {
      const ar = isRestaurantLike(a.card) ? 1 : 0;
      const br = isRestaurantLike(b.card) ? 1 : 0;
      if (ar !== br) return br - ar;
      const aff = isFastFood(a.card) ? 1 : 0;
      const bff = isFastFood(b.card) ? 1 : 0;
      return aff - bff;
    });
    for (const item of pri) {
      if (out.length >= deckSize) break;
      tryPush(item);
    }
    for (const item of pool) {
      if (out.length >= deckSize) break;
      tryPush(item);
    }
    next = out.slice(0, deckSize);
  } else if (detectedIntent === "cafe_general") {
    const pool = eligibleFromOrdered(mergeUniqueById(candidates, source), () => true);
    const sorted = [...pool].sort((a, b) => {
      const ta = isUnmannedCafe(a.card) ? 2 : isDessertLike(a.card) ? 1 : isCafeLike(a.card) ? 0 : 1;
      const tb = isUnmannedCafe(b.card) ? 2 : isDessertLike(b.card) ? 1 : isCafeLike(b.card) ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return pool.indexOf(a) - pool.indexOf(b);
    });
    let arr = sorted.slice(0, deckSize);
    if (arr.length > 0 && isUnmannedCafe(arr[0].card)) {
      const swap = sorted.find((x) => !isUnmannedCafe(x.card) && isCafeLike(x.card));
      if (swap) arr = [swap, ...arr.filter((x) => x.card.id !== swap.card.id)].slice(0, deckSize);
    }
    next = arr;
  } else if (detectedIntent === "date_social") {
    const pool = mergeUniqueById(candidates, source).filter((x) => !isItemBaseExcluded(x));
    const nonFfFirst = [...pool].sort((a, b) => {
      const af = isFastFood(a.card) ? 1 : 0;
      const bf = isFastFood(b.card) ? 1 : 0;
      if (af !== bf) return af - bf;
      return pool.indexOf(a) - pool.indexOf(b);
    });
    next = nonFfFirst.slice(0, deckSize);
  } else {
    next = [...before];
  }

  const afterIds = new Set(next.map((x) => x.card.id));
  for (const item of before) {
    if (!afterIds.has(item.card.id)) removedNames.push(item.card.name);
  }

  return {
    selected: next,
    removedByFinalConstraint: removedNames,
    restaurantLikeCount,
    activityLikeCount,
  };
}

function isUnsafeForKids(card: HomeCard): boolean {
  if (isAlcoholNightlifeVenue(card)) return true;
  const blob = normalizeBlob(card);
  if (UNSAFE_FOR_KIDS_KEYWORDS.some((kw) => blob.includes(kw.toLowerCase()))) return true;
  return UNSAFE_FOR_KIDS_FOOD_KEYWORDS.some((kw) => blob.includes(kw.toLowerCase()));
}

function isExplicitFamilyOutingScenario(scenario: ScenarioObject | null | undefined): boolean {
  const s = String((scenario as any)?.scenario ?? "").toLowerCase();
  return s.includes("family_outing");
}

/** 푸드·식당·맛집·밥·점심·저녁·외식 단일 토큰(내부 q=식당 alias 포함) */
function isGeneralMealRestaurantBrowseQuery(q: string | null | undefined): boolean {
  const t = normalizeBrandQuery(String(q ?? "")).trim();
  return ["푸드", "식당", "맛집", "밥", "점심", "저녁", "외식"].includes(t);
}

function isRestaurantFinalDiversityTarget(params: {
  query: string | null | undefined;
  explicitCategory: string | null | undefined;
  explicitIntent: string | null | undefined;
}): boolean {
  if (isGeneralMealRestaurantBrowseQuery(params.query)) return true;
  if (normalizeBrandQuery(String(params.query ?? "")).trim() === "가족 외식") return true;
  if (normalizeBrandQuery(String(params.query ?? "")).trim() === "아이랑 밥") return true;
  if (String(params.explicitCategory ?? "").trim().toLowerCase() === "restaurant") return true;
  return String(params.explicitIntent ?? "").trim().toLowerCase() === "food_general";
}

function classifyRestaurantBucket(card: HomeCard): string {
  const blob = normalizeBlob(card);
  if (/김밥|분식|떡볶이|라면/.test(blob)) return "gimbap_snack";
  if (/중식|짜장|짬뽕|마라|탕수육/.test(blob)) return "chinese";
  if (/고기|갈비|삼겹|구이|불고기|정육/.test(blob)) return "meat_grill";
  if (/국밥|순대국|찌개|탕|해장/.test(blob)) return "soup_stew";
  if (/회|해산물|수산|어촌|초밥|스시/.test(blob)) return "seafood";
  if (/샤브|칼국수/.test(blob)) return "shabu_noodle";
  if (/양식|파스타|스테이크|피자|리조또/.test(blob)) return "western";
  return "other";
}

const RESTAURANT_LAST_TOP3_IDS_KEY = "hama_restaurant_last_top3_ids";

function readLastRestaurantTop3Ids(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(RESTAURANT_LAST_TOP3_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map((v) => String(v)).filter(Boolean).slice(0, 3) : [];
  } catch {
    return [];
  }
}

function writeLastRestaurantTop3Ids(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(RESTAURANT_LAST_TOP3_IDS_KEY, JSON.stringify(ids.slice(0, 3)));
  } catch {}
}

function applyRestaurantFinalDiversityRotation(params: {
  selected: ScoredRecommendItem[];
  candidates: ScoredRecommendItem[];
  query: string | null | undefined;
  explicitCategory: string | null | undefined;
  explicitIntent: string | null | undefined;
  recentIds: string[];
}): { next: ScoredRecommendItem[]; replacedNames: string[] } {
  const { selected, candidates, query, explicitCategory, explicitIntent, recentIds } = params;
  if (!isRestaurantFinalDiversityTarget({ query, explicitCategory, explicitIntent })) {
    return { next: selected, replacedNames: [] };
  }
  if (candidates.length < 10 || selected.length < 3) {
    return { next: selected, replacedNames: [] };
  }

  const out = [...selected];
  const beforeTop3 = out.slice(0, 3);
  const topPool = candidates.slice(0, 20);
  const recentSet = new Set(recentIds);
  const prevTop3Ids = new Set(readLastRestaurantTop3Ids());
  const used = new Set(out.map((x) => x.card.id));
  const replacedNames: string[] = [];

  const tryReplaceAt = (idx: number, predicate: (c: ScoredRecommendItem) => boolean) => {
    const current = out[idx];
    if (!current) return;
    const replacement = topPool.find((cand) => !used.has(cand.card.id) && predicate(cand));
    if (!replacement) return;
    replacedNames.push(current.card.name);
    used.delete(current.card.id);
    out[idx] = replacement;
    used.add(replacement.card.id);
  };

  for (const idx of [1, 2] as const) {
    const current = out[idx];
    if (!current) continue;
    const currentExposureId = getCardExposureId(current.card);
    const shouldRotate = recentSet.has(currentExposureId) || prevTop3Ids.has(currentExposureId);
    if (!shouldRotate) continue;
    tryReplaceAt(idx, (cand) => {
      const exp = getCardExposureId(cand.card);
      return !recentSet.has(exp) && !prevTop3Ids.has(exp);
    });
  }

  const top3Now = out.slice(0, 3);
  const bucketCounts = top3Now.reduce<Record<string, number>>((acc, item) => {
    const b = classifyRestaurantBucket(item.card);
    acc[b] = (acc[b] ?? 0) + 1;
    return acc;
  }, {});
  const repeatedBucket = Object.entries(bucketCounts).find(([, cnt]) => cnt >= 2)?.[0] ?? null;
  if (repeatedBucket) {
    const candidateIdx = [2, 1].find((i) => classifyRestaurantBucket(out[i]!.card) === repeatedBucket);
    if (typeof candidateIdx === "number") {
      tryReplaceAt(candidateIdx, (cand) => classifyRestaurantBucket(cand.card) !== repeatedBucket);
    }
  }

  const beforeBuckets = beforeTop3.map((x) => classifyRestaurantBucket(x.card));
  const afterBuckets = out.slice(0, 3).map((x) => classifyRestaurantBucket(x.card));
  console.log("[restaurant final diversity rotation]", {
    query,
    poolCount: candidates.length,
    beforeTop3: beforeTop3.map((x) => x.card.name),
    recentIds,
    bucketsBefore: beforeBuckets,
    replacedNames,
    afterTop3: out.slice(0, 3).map((x) => x.card.name),
    bucketsAfter: afterBuckets,
  });

  writeLastRestaurantTop3Ids(out.slice(0, 3).map((x) => getCardExposureId(x.card)));
  return { next: out, replacedNames };
}

function applyFinalFastfoodGuardForGeneralMealBrowse(
  selected: ScoredRecommendItem[],
  orderedCandidates: ScoredRecommendItem[],
  query: string | null | undefined
): { next: ScoredRecommendItem[]; nonFastFoodCount: number; removedFastFoodNames: string[] } {
  if (!isGeneralMealRestaurantBrowseQuery(query)) {
    return { next: selected, nonFastFoodCount: 0, removedFastFoodNames: [] };
  }
  const restaurantOrdered = orderedCandidates.filter((x) => isRestaurantLike(x.card));
  const nonFastFoodRestaurant = restaurantOrdered.filter((x) => !isFastFood(x.card));
  const fastFoodRestaurant = restaurantOrdered.filter((x) => isFastFood(x.card));
  const nonFastFoodCount = nonFastFoodRestaurant.length;
  if (nonFastFoodCount === 0) {
    return { next: selected, nonFastFoodCount, removedFastFoodNames: [] };
  }

  const out = [...selected];
  const removedFastFoodNames: string[] = [];
  const allowedFastfoodInTop3 = nonFastFoodCount >= 3 ? 0 : Math.max(0, 3 - nonFastFoodCount);
  const mustNonInTop3 = Math.min(3, nonFastFoodCount);
  let nonTop3 = out.slice(0, 3).filter((x) => !isFastFood(x.card)).length;
  let fastTop3 = out.slice(0, 3).filter((x) => isFastFood(x.card)).length;
  const used = new Set(out.map((x) => x.card.id));
  let nonCursor = 0;
  let ffCursor = 0;
  const nextNon = () => {
    while (nonCursor < nonFastFoodRestaurant.length) {
      const candidate = nonFastFoodRestaurant[nonCursor++]!;
      if (used.has(candidate.card.id)) continue;
      return candidate;
    }
    return null;
  };
  const nextFast = () => {
    while (ffCursor < fastFoodRestaurant.length) {
      const candidate = fastFoodRestaurant[ffCursor++]!;
      if (used.has(candidate.card.id)) continue;
      return candidate;
    }
    return null;
  };

  for (let i = 0; i < Math.min(3, out.length); i++) {
    const current = out[i]!;
    const currentIsFast = isFastFood(current.card);
    const currentNonTop3 = nonTop3;
    const currentFastTop3 = fastTop3;
    const needReplaceForNonQuota =
      currentIsFast && currentNonTop3 < mustNonInTop3;
    const needReplaceForFastQuota =
      currentIsFast && currentFastTop3 > allowedFastfoodInTop3;
    if (!needReplaceForNonQuota && !needReplaceForFastQuota) continue;
    const replacement = nextNon() ?? (allowedFastfoodInTop3 > 0 ? nextFast() : null);
    if (!replacement) continue;
    removedFastFoodNames.push(current.card.name);
    used.delete(current.card.id);
    out[i] = replacement;
    used.add(replacement.card.id);
    if (currentIsFast) fastTop3 = Math.max(0, fastTop3 - 1);
    if (!isFastFood(replacement.card)) nonTop3 += 1;
    if (isFastFood(replacement.card)) fastTop3 += 1;
  }

  return { next: out, nonFastFoodCount, removedFastFoodNames };
}

/** 일반 식당 후보가 충분할 때 top3에서 술집·이자카야 계열 제거 */
function demoteAlcoholFromTopForGeneralMealBrowse(
  selected: ScoredRecommendItem[],
  orderedCandidates: ScoredRecommendItem[],
  query: string | null | undefined
): { next: ScoredRecommendItem[]; removedUnsafeNames: string[] } {
  if (!isGeneralMealRestaurantBrowseQuery(query)) {
    return { next: selected, removedUnsafeNames: [] };
  }
  const nonAlcRestCount = orderedCandidates.filter(
    (x) => isRestaurantLike(x.card) && !isAlcoholNightlifeVenue(x.card)
  ).length;
  if (nonAlcRestCount < 3) return { next: selected, removedUnsafeNames: [] };

  const removedUnsafeNames: string[] = [];
  const out = [...selected];
  const used = new Set(out.map((x) => x.card.id));
  for (let i = 0; i < Math.min(3, out.length); i++) {
    if (!isAlcoholNightlifeVenue(out[i]!.card)) continue;
    const repl = orderedCandidates.find(
      (c) => !used.has(c.card.id) && !isAlcoholNightlifeVenue(c.card)
    );
    if (!repl) continue;
    removedUnsafeNames.push(out[i]!.card.name);
    used.delete(out[i]!.card.id);
    out[i] = repl;
    used.add(repl.card.id);
  }
  return { next: out, removedUnsafeNames };
}

function normalizeStrictExplicitGateCategory(
  c: string | null | undefined
): "life" | "culture" | "fitness" | null {
  const x = (c ?? "").trim().toLowerCase();
  if (x === "life" || x === "culture" || x === "fitness") return x;
  return null;
}

function isRecentExposureTargetQuery(
  query: string | null | undefined,
  explicitCategory: string | null | undefined
): boolean {
  if (getSituationQueryPreset(query)) return true;
  const t = normalizeBrandQuery(String(query ?? "")).trim();
  if (
    [
      "푸드",
      "식당",
      "맛집",
      "가족 외식",
      "가족외식",
      "가족 식사",
      "가족이랑 외식",
      "가족이랑 밥",
      "가족이랑 식사",
      "아이랑 밥",
      "카페",
      "문화",
      "박물관",
      "도서관",
      "미술관",
    ].includes(t)
  ) {
    return true;
  }
  if (matchNamedFoodPreset(String(query ?? "").trim())) return true;
  return String(explicitCategory ?? "").trim().toLowerCase() === "culture";
}

/** 랭킹·solo strip — URL q와 달리 `searchQuery`만 넘어오는 경우 대비해 rawQuery도 검사 */
function isSoloSituationIntentQuery(
  query: string | null | undefined,
  scenario: ScenarioObject | null | undefined
): boolean {
  if (scenario?.scenario === "solo") return true;
  const raw = String(scenario?.rawQuery ?? "").trim();
  if (raw && textMatchesSoloSituationIntent(raw)) return true;
  return textMatchesSoloSituationIntent(query ?? null);
}

function soloIntentFitDelta(card: HomeCard): number {
  const b = normalizeBlob(card);
  const c = card as {
    categoryLabel?: string | null;
    tags?: string[] | unknown;
    menu_keywords?: string[] | unknown;
    solo_friendly?: boolean | null;
    quick_service?: boolean | null;
  };
  const categoryLabelBlob = normalizeBrandQuery(String(c.categoryLabel ?? "").toLowerCase());
  const tagsBlob = normalizeBrandQuery(
    (Array.isArray(c.tags) ? c.tags.join(" ") : String(c.tags ?? "")).toLowerCase()
  );
  const menuKeywordsBlob = normalizeBrandQuery(
    (Array.isArray(c.menu_keywords) ? c.menu_keywords.join(" ") : String(c.menu_keywords ?? "")).toLowerCase()
  );
  const cuisineSignalBlob = `${categoryLabelBlob} ${tagsBlob} ${menuKeywordsBlob}`.trim();
  let d = 0;

  // 혼밥 intent 재정렬 우선 항목
  if (/국밥|순대국|곰탕|설렁탕|해장국/.test(b)) d += 90;
  if (/김밥|꼬마김밥/.test(b)) d += 84;
  if (/분식|떡볶이|어묵|튀김/.test(b)) d += 76;
  if (/우동|소바/.test(b)) d += 52;
  if (/1인식당|1인\s*석|혼밥|혼자\s*식사|카운터\s*좌석|바테이블|counter/.test(b)) d += 64;
  if ((c.solo_friendly ?? false) === true) d += 58;
  if ((c.quick_service ?? false) === true || /빠른\s*식사|quick\s*meal|회전\s*빠름/.test(b)) d += 44;
  if (isCafeLike(card) && /조용|한적|집중|작업|독서/.test(b)) d += 42;

  if (isRestaurantLike(card)) d += 36;
  if (isCafeLike(card) || isDessertLike(card)) d += 24;
  if (/국밥|분식|백반|덮밥|김밥|칼국수|우동/.test(b)) d += 20;
  if (/조용|한적|혼밥|1인|카운터|바테이블|빠른\s*식사|가성비/.test(b)) d += 16;

  // solo intent에서는 cuisine/categoryLabel/tags/menu_keywords 기반 중식 계열 부스트를 강하게 감쇠
  if (/중식|중국집|중화요리|마라|짬뽕|탕수육|훠궈|양꼬치/.test(cuisineSignalBlob)) d -= 190;
  if (/중식|중국집|중화요리|마라|짬뽕|탕수육|훠궈|양꼬치/.test(b)) d -= 110;

  if (/키즈카페|키즈\s*카페/.test(b)) d -= 130;
  if (/가족\s*외식|가족모임|가족식사|아이동반|키즈존|대형\s*식당|룸\s*완비|단체석/.test(b)) d -= 96;
  if (isAlcoholNightlifeVenue(card) || /포차|호프|주점|이자카야|단체|회식/.test(b)) d -= 112;
  if (isCultureLike(card) || hasCultureAnchor(card) || /도서관|박물관|미술관|전시/.test(b)) d -= 72;

  return d;
}

/** solo intent: 중식 계열 top3 하드 블록 — categoryLabel/tags/menu/name/blob 중 한 필드라도 강 매칭 시 제외 */
const SOLO_CHINESE_HARD_BLOCK_RE =
  /(?:중식|중국집|중화요리|마라|짬뽕|탕수육|훠궈|양꼬치)/;

function soloChineseHardBlockException(card: HomeCard): boolean {
  const c = card as {
    solo_friendly?: boolean | null;
  };
  if ((c.solo_friendly ?? false) === true) return true;
  const inspect = buildSoloChineseInspectBlob(card);
  let hits = 0;
  if (/혼밥/.test(inspect)) hits += 1;
  if (/1인|1인석|1인식당/.test(inspect)) hits += 1;
  if (/\bsolo\b|솔로/.test(inspect)) hits += 1;
  if (/counter|카운터/.test(inspect)) hits += 1;
  if (/quick\s*meal|빠른\s*식사/.test(inspect)) hits += 1;
  if (/혼자/.test(inspect)) hits += 1;
  if (/작은\s*매장|작은매장|소규모|아담한|소형/.test(inspect)) hits += 1;
  return hits >= 2;
}

function buildSoloChineseInspectBlob(card: HomeCard): string {
  const c = card as {
    name?: string | null;
    categoryLabel?: string | null;
    tags?: string[] | unknown;
    menu_keywords?: string[] | unknown;
  };
  const tags = Array.isArray(c.tags) ? c.tags.join(" ") : String(c.tags ?? "");
  const menuKw = Array.isArray(c.menu_keywords) ? c.menu_keywords.join(" ") : String(c.menu_keywords ?? "");
  const parts = [String(c.name ?? ""), String(c.categoryLabel ?? ""), tags, menuKw, normalizeBlob(card)];
  return normalizeBrandQuery(parts.join(" ").toLowerCase()).trim();
}

function soloChineseHardBlockHit(card: HomeCard): boolean {
  const c = card as {
    name?: string | null;
    categoryLabel?: string | null;
    tags?: string[] | unknown;
    menu_keywords?: string[] | unknown;
  };
  const nameN = normalizeBrandQuery(String(c.name ?? "").toLowerCase());
  const labN = normalizeBrandQuery(String(c.categoryLabel ?? "").toLowerCase());
  const tagsN = normalizeBrandQuery(
    (Array.isArray(c.tags) ? c.tags.join(" ") : String(c.tags ?? "")).toLowerCase()
  );
  const menuN = normalizeBrandQuery(
    (Array.isArray(c.menu_keywords) ? c.menu_keywords.join(" ") : String(c.menu_keywords ?? "")).toLowerCase()
  );
  const blobN = normalizeBrandQuery(normalizeBlob(card));
  return (
    SOLO_CHINESE_HARD_BLOCK_RE.test(nameN) ||
    SOLO_CHINESE_HARD_BLOCK_RE.test(labN) ||
    SOLO_CHINESE_HARD_BLOCK_RE.test(tagsN) ||
    SOLO_CHINESE_HARD_BLOCK_RE.test(menuN) ||
    SOLO_CHINESE_HARD_BLOCK_RE.test(blobN)
  );
}

function soloChineseTop3HardBlocked(item: ScoredRecommendItem): boolean {
  if (soloChineseHardBlockException(item.card)) return false;
  return soloChineseHardBlockHit(item.card);
}

function soloChineseTop3NormalizeDebug(card: HomeCard): {
  nameN: string;
  categoryLabelN: string;
  tagsN: string;
  menuKeywordsN: string;
  blobN: string;
} {
  const c = card as {
    name?: string | null;
    categoryLabel?: string | null;
    tags?: string[] | unknown;
    menu_keywords?: string[] | unknown;
  };
  const tagsRaw = Array.isArray(c.tags) ? c.tags.join(" ") : String(c.tags ?? "");
  const menuRaw = Array.isArray(c.menu_keywords) ? c.menu_keywords.join(" ") : String(c.menu_keywords ?? "");
  return {
    nameN: normalizeBrandQuery(String(c.name ?? "").toLowerCase()),
    categoryLabelN: normalizeBrandQuery(String(c.categoryLabel ?? "").toLowerCase()),
    tagsN: normalizeBrandQuery(tagsRaw.toLowerCase()),
    menuKeywordsN: normalizeBrandQuery(menuRaw.toLowerCase()),
    blobN: normalizeBrandQuery(normalizeBlob(card)),
  };
}

/**
 * 최종 picked 직전: solo intent에서 top3만 중식 계열 strip 후보로 교체 (점수 아닌 후보 제거).
 * applyReasonTemplateEngine 이전에만 호출된다.
 */
function applySoloIntentChineseTop3HardStrip(
  picked: ScoredRecommendItem[],
  pool: ScoredRecommendItem[],
  query: string | null,
  scenario: ScenarioObject | null | undefined
): ScoredRecommendItem[] {
  const isSoloSituationQuery = isSoloSituationIntentQuery(query, scenario);

  hamaDevLog("[HAMA_SOLO_TOP3_BLOCK_ENTER]", {
    tag: "inside_apply_first_line",
    query,
    pickedLength: picked.length,
    isSoloSituationQuery,
    scenarioRawQuery: scenario?.rawQuery ?? null,
    effectiveScenarioScenario: scenario?.scenario ?? null,
    optionsSearchQuery: query,
    poolLength: pool.length,
  });

  if (picked.length === 0) {
    hamaDevLog("[HAMA_SOLO_TOP3_BLOCK_EARLY]", {
      reason: "picked_empty",
      pickedLength: picked.length,
      isSoloSituationQuery,
      poolLength: pool.length,
    });
    return picked;
  }

  if (!isSoloSituationQuery) {
    hamaDevLog("[HAMA_SOLO_TOP3_BLOCK_EARLY]", {
      reason: "not_solo_situation_query",
      query,
      scenarioRawQuery: scenario?.rawQuery ?? null,
      scenarioScenario: scenario?.scenario ?? null,
      pickedLength: picked.length,
      poolLength: pool.length,
    });
    return picked;
  }

  if (pool.length === 0) {
    hamaDevLog("[HAMA_SOLO_TOP3_BLOCK_GUARD]", {
      reason: "solo_chinese_strip_pool_empty",
      note: "replacements_impossible_until_pool_refills",
      pickedLength: picked.length,
    });
  }

  const topSlots = Math.min(3, picked.length);
  const head = picked.slice(0, topSlots);
  const anyTop3HardBlocked = head.some((x) => soloChineseTop3HardBlocked(x));
  const poolLen = pool.length;
  const poolNonBlockedCount = pool.filter((c) => !soloChineseTop3HardBlocked(c)).length;

  const shouldLog = isSoloSituationQuery || anyTop3HardBlocked;

  const poolSorted = [...pool].sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore);
  const used = new Set(picked.map((x) => x.card.id));
  const out = [...picked];
  const top3Log: Array<{
    name: string;
    blockedBySoloChineseHardBlock: boolean;
    allowBySoloException: boolean;
    replaceAttempted: boolean;
    replacementName: string | null;
    normalizeBrandQuery: ReturnType<typeof soloChineseTop3NormalizeDebug>;
  }> = [];

  for (let i = 0; i < topSlots; i += 1) {
    const cur = out[i]!;
    const card = cur.card;
    const blocked = soloChineseTop3HardBlocked(cur);
    const allowEx = soloChineseHardBlockException(card);
    let replaceAttempted = false;
    let replacementName: string | null = null;

    if (blocked) {
      replaceAttempted = true;
      const repl = poolSorted.find((c) => !used.has(c.card.id) && !soloChineseTop3HardBlocked(c));
      if (repl) {
        replacementName = repl.card.name;
        used.delete(cur.card.id);
        out[i] = repl;
        used.add(repl.card.id);
      }
    }

    top3Log.push({
      name: card.name,
      blockedBySoloChineseHardBlock: blocked,
      allowBySoloException: allowEx,
      replaceAttempted,
      replacementName,
      normalizeBrandQuery: soloChineseTop3NormalizeDebug(card),
    });
  }

  if (shouldLog) {
    hamaDevLog("[HAMA_SOLO_TOP3_BLOCK_DEBUG]", {
      query,
      scenarioRawQuery: scenario?.rawQuery ?? null,
      scenarioScenario: scenario?.scenario ?? null,
      isSoloSituationQuery,
      poolLen,
      poolNonBlockedCount,
      poolAllHardBlocked: poolLen > 0 && poolNonBlockedCount === 0,
      top3: top3Log,
      finalTop3Names: out.slice(0, 3).map((x) => x.card.name),
      note: "solo_strip_applied_or_evaluated",
    });
  }

  return out;
}

function applyRecentExposureDiversity(params: {
  selected: ScoredRecommendItem[];
  orderedCandidates: ScoredRecommendItem[];
  query: string | null | undefined;
  explicitCategory: string | null | undefined;
}): { next: ScoredRecommendItem[]; recentIds: string[]; replacedNames: string[] } {
  const { selected, orderedCandidates, query, explicitCategory } = params;
  if (!isRecentExposureTargetQuery(query, explicitCategory)) {
    return { next: selected, recentIds: [], replacedNames: [] };
  }
  const recentIds = readRecentExposedStoreIds();
  if (recentIds.length === 0 || selected.length === 0) {
    return { next: selected, recentIds, replacedNames: [] };
  }
  const recentSet = new Set(recentIds);
  const nonRecentInPool = orderedCandidates.filter((candidate) => {
    const exposureId = getCardExposureId(candidate.card);
    return Boolean(exposureId) && !recentSet.has(exposureId);
  }).length;
  const namedFoodMatched = Boolean(matchNamedFoodPreset(String(query ?? "").trim()));
  const topSlotStart =
    namedFoodMatched ? 0
    : nonRecentInPool >= 8 ? 0
    : 1;
  console.log("[recent exposure id match check]", {
    query,
    candidateNames: orderedCandidates.slice(0, 10).map((x) => {
      const c = x.card as any;
      const id = String(c.id ?? "");
      const placeId = String(c.place_id ?? "");
      const storeId = String(c.store_id ?? "");
      const exposureId = getCardExposureId(x.card);
      return {
        name: x.card.name,
        id,
        place_id: placeId,
        store_id: storeId,
        recentMatched: recentSet.has(exposureId),
      };
    }),
  });
  const out = [...selected];
  const usedCardIds = new Set(out.map((x) => x.card.id));
  const replacedNames: string[] = [];
  const limit = Math.min(3, out.length);
  for (let i = topSlotStart; i < limit; i += 1) {
    const current = out[i]!;
    const currentExposureId = getCardExposureId(current.card);
    if (!recentSet.has(currentExposureId)) continue;
    const replacement = orderedCandidates.find((candidate) => {
      if (usedCardIds.has(candidate.card.id)) return false;
      const exposureId = getCardExposureId(candidate.card);
      if (!exposureId) return false;
      return !recentSet.has(exposureId);
    });
    if (!replacement) continue;
    replacedNames.push(current.card.name);
    usedCardIds.delete(current.card.id);
    out[i] = replacement;
    usedCardIds.add(replacement.card.id);
  }
  return { next: out, recentIds, replacedNames };
}

function top3ExposureFingerprintForDeck(deck: readonly ScoredRecommendItem[]): string {
  return deck
    .slice(0, 3)
    .map((x) => `${getCardExposureId(x.card) || x.card.id}`)
    .join(">");
}

/** 같은 점수대에서는 searchAttempt 기반으로 순서가 흔들리도록 한다(의도 피팅 없을 때 안정 순서 방지). */
function applyNamedFoodSearchAttemptScoreBandShuffle(
  items: ScoredRecommendItem[],
  opts: { query: string; presetId: string; searchAttempt: number }
): ScoredRecommendItem[] {
  if (items.length < 2) return items;
  const headLen = Math.min(36, items.length);
  const head = items.slice(0, headLen);
  const tail = items.slice(headLen);
  const band = 7;
  const sortedHead = [...head].sort((a, b) => {
    const db = b.breakdown.finalScore;
    const da = a.breakdown.finalScore;
    const qb = Math.floor(db / band);
    const qa = Math.floor(da / band);
    if (qb !== qa) return db - da;
    const ja = hashString(`${opts.query}|${opts.presetId}|band|${opts.searchAttempt}|${a.card.id}`) % 131071;
    const jb = hashString(`${opts.query}|${opts.presetId}|band|${opts.searchAttempt}|${b.card.id}`) % 131071;
    if (jb !== ja) return jb - ja;
    return db - da;
  });
  return [...sortedHead, ...tail];
}

function deprioritizeRecentInNamedFoodTop(
  deck: ScoredRecommendItem[],
  pool: ScoredRecommendItem[],
  cap: number,
  recentSet: Set<string>,
  excludedRecentNames: string[]
): ScoredRecommendItem[] {
  const out = [...deck];
  const used = new Set(out.map((x) => x.card.id));
  const limit = Math.min(3, cap, out.length);
  for (let i = 0; i < limit; i++) {
    const exp = String(getCardExposureId(out[i]!.card) || "").trim();
    if (!exp || !recentSet.has(exp)) continue;
    const repl = pool.find((c) => {
      if (used.has(c.card.id)) return false;
      const e = String(getCardExposureId(c.card) || "").trim();
      return Boolean(e) && !recentSet.has(e);
    });
    if (!repl) continue;
    excludedRecentNames.push(out[i]!.card.name);
    used.delete(out[i]!.card.id);
    out[i] = repl;
    used.add(repl.card.id);
  }
  return out;
}

function avoidTripleTop1Same(
  deck: ScoredRecommendItem[],
  pool: ScoredRecommendItem[],
  query: string | null,
  presetId: string
): ScoredRecommendItem[] {
  if (deck.length === 0) return deck;
  const state = readNamedFoodTop1Streak(query, presetId);
  const topExp = String(getCardExposureId(deck[0]!.card) || deck[0]!.card.id || "").trim();
  if (!topExp || !state || state.streak < 2 || state.lastId !== topExp) return deck;
  const used = new Set(deck.map((x) => x.card.id));
  const alt = pool.find((c) => {
    if (used.has(c.card.id)) return false;
    const e = String(getCardExposureId(c.card) || c.card.id || "").trim();
    return Boolean(e) && e !== topExp;
  });
  if (!alt) return deck;
  const out = [...deck];
  out[0] = alt;
  return out;
}

function applyNamedFoodPresetDeckRotation(
  picked: ScoredRecommendItem[],
  mergedPool: ScoredRecommendItem[],
  params: {
    query: string | null;
    preset: NamedFoodPreset;
    searchAttempt: number;
    deckCap: number;
    candidateCount: number;
  }
): ScoredRecommendItem[] {
  const cap = Math.min(3, params.deckCap, picked.length);
  if (cap === 0) return picked;

  const recentOrdered = readRecentExposedStoreIds();
  const recentSet = new Set(recentOrdered);
  const beforeNames = picked.slice(0, 3).map((x) => x.card.name);

  const excludedRecentNames: string[] = [];
  let next = deprioritizeRecentInNamedFoodTop(picked, mergedPool, cap, recentSet, excludedRecentNames);

  if (mergedPool.length >= 6) {
    const prevFp = readNamedFoodPrevTop3Fingerprint(params.query, params.preset.id);
    const curFp = top3ExposureFingerprintForDeck(next);
    if (prevFp && prevFp === curFp) {
      const used = new Set(next.slice(0, cap).map((x) => x.card.id));
      const alt = mergedPool.find((c) => !used.has(c.card.id));
      if (alt) {
        const out = [...next];
        const replaceIdx = cap >= 3 ? 2 : Math.max(0, cap - 1);
        out[replaceIdx] = alt;
        next = out;
      }
    }
  }

  next = avoidTripleTop1Same(next, mergedPool, params.query, params.preset.id);

  const afterNames = next.slice(0, 3).map((x) => x.card.name);
  if (params.preset.id === "tonkatsu") {
    hamaDevLog("[HAMA_TONKATSU_ROTATION]", {
      query: params.query,
      searchAttempt: params.searchAttempt,
      recentIdsCount: recentOrdered.length,
      candidateCount: params.candidateCount,
      beforeNames,
      afterNames,
      excludedRecentNames,
    });
  }

  return next;
}

/** 홈 퀵 `explicitCategory=life|culture|fitness` — 최종 덱·페치 후보에서 식당 등 강제 배제 */
function passesExplicitCategoryDeck(card: HomeCard, cat: "life" | "culture" | "fitness"): boolean {
  if (cat === "life") {
    if (
      isFoodLike(card) ||
      isCafeLike(card) ||
      isDessertLike(card) ||
      isBeautyLike(card) ||
      isActivityLike(card) ||
      isFitnessLike(card) ||
      isCultureLike(card)
    ) {
      return false;
    }
    return isLifeLike(card);
  }
  if (cat === "culture") {
    if (
      isFoodLike(card) ||
      isCafeLike(card) ||
      isDessertLike(card) ||
      isBeautyLike(card) ||
      isFitnessLike(card) ||
      isLifeLike(card)
    ) {
      return false;
    }
    return isCultureLike(card) || hasCultureAnchor(card);
  }
  if (cat === "fitness") {
    if (isFoodLike(card) || isCafeLike(card) || isDessertLike(card) || isBeautyLike(card) || isLifeLike(card) || isCultureLike(card)) {
      return false;
    }
    if (isActivityLike(card) && !isFitnessLike(card)) return false;
    return isFitnessLike(card);
  }
  return true;
}

type SafetyDiversityOutcome = {
  deck: ScoredRecommendItem[];
  recentExposureReplacements: number;
};

function applySafetyAndDiversity(
  picked: ScoredRecommendItem[],
  allRanked: ScoredRecommendItem[],
  query: string | null | undefined,
  scenario: ScenarioObject | null | undefined,
  explicitCategory?: string | null,
  diagnostics?: {
    explicitIntent?: string | null;
    fetchedCount?: number;
    rankedPoolCount?: number;
    searchAttempt?: number;
    /** 명시 음식 프리셋 등 — 덱 최대 5까지 */
    deckCap?: number;
    namedFoodPresetId?: string | null;
  }
): SafetyDiversityOutcome {
  const cap = Math.min(5, Math.max(3, diagnostics?.deckCap ?? RECOMMEND_DECK_SIZE));
  const recentOrdered = readRecentExposedStoreIds();
  const kidsFamily = isKidsFamilyIntent(query, scenario);
  const soloSituation = isSoloSituationIntentQuery(query, scenario);
  const detectedIntent = detectIntentFit(query, scenario);
  const excludeNightlifeFromPool =
    kidsFamily ||
    detectedIntent === "kids_meal" ||
    detectedIntent === "kids_outing" ||
    detectedIntent === "kids_cafe" ||
    detectedIntent === "family_dining" ||
    isExplicitFamilyOutingScenario(scenario);
  const blockKidsUnsafePool = kidsFamily || excludeNightlifeFromPool;
  const dayBucket = new Date().toISOString().slice(0, 10);
  const sessionSeed = getSessionSeed();
  const source = [...picked, ...allRanked].filter(
    (item, idx, arr) => arr.findIndex((x) => x.card.id === item.card.id) === idx
  );
  const gateCat = normalizeStrictExplicitGateCategory(explicitCategory);
  const explicitCategoryGateBefore = source.length;
  const explicitCategoryRemovedNames: string[] = [];
  const pipelineSource = gateCat
    ? source.filter((item) => {
        const ok = passesExplicitCategoryDeck(item.card, gateCat);
        if (!ok) explicitCategoryRemovedNames.push(item.card.name);
        return ok;
      })
    : source;

  const topBefore = pipelineSource.slice(0, cap).map((x) => x.card.name);
  const removedNames: string[] = [];
  const fastFoodBefore = pipelineSource.filter((x) => detectFastFoodBrand(x.card)).length;

  let candidates = pipelineSource.filter((item) => {
    if (!blockKidsUnsafePool) return true;
    const bad = isUnsafeForKids(item.card);
    if (bad) removedNames.push(item.card.name);
    return !bad;
  });

  candidates = candidates
    .map((item, idx) => {
      const fit = intentFitDelta(detectedIntent, item.card) + (soloSituation ? soloIntentFitDelta(item.card) : 0);
      const jitterKey = `${String(query ?? "")}|${dayBucket}|${sessionSeed}|${diagnostics?.searchAttempt ?? 0}|${item.card.id}|${idx}`;
      const jitter = hashString(jitterKey);
      const penMul = diagnostics?.namedFoodPresetId ? 1.48 : 1;
      const exposurePen = recentExposureSortPenalty(getCardExposureId(item.card), recentOrdered) * penMul;
      return { item, idx, fit, jitter, exposurePen };
    })
    .sort((a, b) => {
      const adjA = a.fit - a.exposurePen;
      const adjB = b.fit - b.exposurePen;
      const diff = adjB - adjA;
      if (Math.abs(diff) <= 12 && diff !== 0) return b.jitter - a.jitter;
      if (diff !== 0) return diff;
      const jitterTie = b.jitter - a.jitter;
      if (jitterTie !== 0) return jitterTie;
      return String(a.item.card.id ?? "").localeCompare(String(b.item.card.id ?? ""));
    })
    .map((x) => x.item);

  const removedByGate: string[] = [];
  const removedByGateIds = new Set<string>();
  const unsafeIds = new Set<string>();
  if (blockKidsUnsafePool) {
    for (const item of pipelineSource) {
      if (isUnsafeForKids(item.card)) unsafeIds.add(item.card.id);
    }
  }
  const gateOut = (item: ScoredRecommendItem): boolean => {
    if (detectedIntent === "family_dining") {
      if (isAlcoholNightlifeVenue(item.card)) return true;
      if (isBeautyLike(item.card)) return true;
      if (isCafeLike(item.card)) return true;
      if (isActivityLike(item.card)) return true;
      if (isDessertLike(item.card)) return true;
      return false;
    }
    if (detectedIntent === "kids_meal") {
      if (isAlcoholNightlifeVenue(item.card)) return true;
      if (isBeautyLike(item.card)) return true;
      if (isActivityLike(item.card)) return true;
      return false;
    }
    if (detectedIntent === "kids_cafe") {
      if (isAlcoholNightlifeVenue(item.card)) return true;
      return false;
    }
    if (detectedIntent === "kids_outing") {
      if (isAlcoholNightlifeVenue(item.card)) return true;
      if (isBeautyLike(item.card)) return true;
      return false;
    }
    return false;
  };

  const beforeGateTop = candidates.slice(0, cap).map((x) => x.card.name);
  candidates = candidates.filter((item) => {
    const out = gateOut(item);
    if (out) {
      removedByGate.push(item.card.name);
      removedByGateIds.add(item.card.id);
    }
    return !out;
  });

  let selected: ScoredRecommendItem[] = [];
  let fallbackUsed = false;
  const usedBrands = new Set<string>();
  const usedCategories = new Set<string>();

  const intentPrefersNoCafe =
    detectedIntent === "kids_meal" || detectedIntent === "family_dining";
  const intentWantsActivity = detectedIntent === "kids_outing";
  const hasActivityCandidate = candidates.some((x) => categoryOf(x.card) === "activity");
  const restaurantCandidates = candidates.filter((x) => isRestaurantLike(x.card)).length;
  const cafeCandidates = candidates.filter((x) => isCafeLike(x.card)).length;
  const fastFoodCandidates = candidates.filter((x) => isFastFood(x.card)).length;
  const hardExcludeCafeTop3 = intentPrefersNoCafe && restaurantCandidates >= 2;

  for (const item of candidates) {
    if (selected.length >= cap) break;
    const brand = detectFastFoodBrand(item.card);
    if (brand && usedBrands.size >= 1) continue;
    if (hardExcludeCafeTop3 && isCafeLike(item.card) && candidates.some((x) => isRestaurantLike(x.card))) {
      continue;
    }
    if (detectedIntent === "kids_meal" && brand && restaurantCandidates >= 2 && selected.length === 0) continue;
    if (detectedIntent === "family_dining" && brand && restaurantCandidates >= 2 && selected.length < 2) continue;
    if (detectedIntent === "kids_outing" && isFastFood(item.card)) continue;
    if (detectedIntent === "cafe_general" && isUnmannedCafe(item.card) && selected.length === 0) {
      const hasNormalCafe = candidates.some((x) => isCafeLike(x.card) && !isUnmannedCafe(x.card));
      if (hasNormalCafe) continue;
    }
    if (detectedIntent === "cafe_general" && selected.length === 0 && isDessertLike(item.card)) {
      const hasGeneralCafe = candidates.some(
        (x) => isCafeLike(x.card) && !isDessertLike(x.card) && !isUnmannedCafe(x.card)
      );
      if (hasGeneralCafe) continue;
    }
    const cat = String(item.card.category ?? "");
    if (selected.length === 2 && usedCategories.size === 1 && usedCategories.has(cat)) {
      // 3번째 카드는 가능하면 다른 카테고리를 우선
      const altExists = candidates.some((x) => !usedCategories.has(String(x.card.category ?? "")));
      if (altExists) continue;
    }
    selected.push(item);
    if (brand) usedBrands.add(brand);
    if (cat) usedCategories.add(cat);
  }

  if (selected.length < cap) {
    fallbackUsed = true;
    for (const item of candidates) {
      if (selected.length >= cap) break;
      if (selected.some((x) => x.card.id === item.card.id)) continue;
      if (
        hardExcludeCafeTop3 &&
        isCafeLike(item.card) &&
        candidates.some((x) => isRestaurantLike(x.card))
      ) {
        continue;
      }
      if (detectedIntent === "kids_outing" && isFastFood(item.card)) continue;
      if (detectedIntent === "cafe_general" && isUnmannedCafe(item.card) && selected.length === 0) continue;
      if (detectedIntent === "cafe_general" && selected.length === 0 && isDessertLike(item.card)) {
        const hasGeneralCafe = candidates.some(
          (x) => isCafeLike(x.card) && !isDessertLike(x.card) && !isUnmannedCafe(x.card)
        );
        if (hasGeneralCafe) continue;
      }
      if (removedByGateIds.has(item.card.id)) continue;
      if (isBlockedByFinalDeckIntent(detectedIntent, item.card)) continue;
      selected.push(item);
    }
  }

  if (
    intentWantsActivity &&
    hasActivityCandidate &&
    !selected.some((x) => categoryOf(x.card) === "activity")
  ) {
    const activityPick = candidates.find((x) => categoryOf(x.card) === "activity");
    if (activityPick) {
      if (selected.length < cap) selected.push(activityPick);
      else selected[selected.length - 1] = activityPick;
    }
  }

  if (selected.length < cap) {
    fallbackUsed = true;
    const topCategory = selected[0] ? categoryOf(selected[0].card) : null;
    const safePool = pipelineSource.filter((x) => {
      if (selected.some((s) => s.card.id === x.card.id)) return false;
      if (blockKidsUnsafePool && isUnsafeForKids(x.card)) return false;
      if (unsafeIds.has(x.card.id)) return false;
      if (removedByGateIds.has(x.card.id)) return false;
      if (detectedIntent === "kids_outing" && isBeautyLike(x.card)) return false;
      if (detectedIntent === "kids_meal" && (isBeautyLike(x.card) || isActivityLike(x.card))) return false;
      if (detectedIntent === "family_dining" && isBeautyLike(x.card)) return false;
      if (detectedIntent === "family_dining" && restaurantCandidates >= 2 && isCafeLike(x.card)) return false;
      if (detectedIntent === "family_dining" && restaurantCandidates >= 2 && isDessertLike(x.card)) return false;
      if (detectedIntent === "family_dining" && restaurantCandidates >= 2 && isFastFood(x.card)) return false;
      if (isBlockedByFinalDeckIntent(detectedIntent, x.card)) return false;
      return true;
    });
    const supplement = [
      ...safePool.filter((x) => intentFitDelta(detectedIntent, x.card) > 0),
      ...(topCategory ? safePool.filter((x) => categoryOf(x.card) === topCategory) : []),
      ...safePool,
    ];
    for (const item of supplement) {
      if (selected.length >= cap) break;
      if (selected.some((s) => s.card.id === item.card.id)) continue;
      if (hardExcludeCafeTop3 && isCafeLike(item.card) && restaurantCandidates >= 2) continue;
      if (detectedIntent === "family_dining" && isCafeLike(item.card) && restaurantCandidates >= 2) continue;
      if (detectedIntent === "family_dining" && isDessertLike(item.card) && restaurantCandidates >= 2) continue;
      if (detectedIntent === "family_dining" && isFastFood(item.card) && restaurantCandidates >= 2) continue;
      if (detectedIntent === "kids_outing" && isBeautyLike(item.card)) continue;
      if (detectedIntent === "cafe_general" && selected.length === 0 && isDessertLike(item.card)) {
        const hasGeneralCafe = safePool.some(
          (x) => isCafeLike(x.card) && !isDessertLike(x.card) && !isUnmannedCafe(x.card)
        );
        if (hasGeneralCafe) continue;
      }
      if (removedByGateIds.has(item.card.id)) continue;
      if (unsafeIds.has(item.card.id)) continue;
      if (isBlockedByFinalDeckIntent(detectedIntent, item.card)) continue;
      selected.push(item);
    }
  }

  const beforeFinalDeck = selected.map((x) => x.card.name);
  let finalDeckResult: FinalDeckConstraintResult = {
    selected,
    removedByFinalConstraint: [],
    restaurantLikeCount: candidates.filter((x) => isRestaurantLike(x.card)).length,
    activityLikeCount: candidates.filter((x) => isActivityLike(x.card)).length,
  };
  if (selected.length > 0) {
    const beforeConstraintSelected = [...selected];
    finalDeckResult = applyFinalDeckConstraint({
      detectedIntent,
      selected,
      candidates,
      source: pipelineSource,
      removedByGateIds,
      unsafeIds,
      kidsFamily,
      deckSize: cap,
    });
    selected = finalDeckResult.selected;
    // final constraint가 0개를 만들면 constraint를 무시하고 fallback pool을 사용한다.
    if (selected.length === 0) {
      const fallbackPool = mergeUniqueById(candidates, pipelineSource).filter((item) => {
        if (removedByGateIds.has(item.card.id)) return false;
        if (unsafeIds.has(item.card.id)) return false;
        if (kidsFamily && isUnsafeForKids(item.card)) return false;
        return true;
      });
      selected =
        fallbackPool.slice(0, cap).length > 0
          ? fallbackPool.slice(0, cap)
          : beforeConstraintSelected.slice(0, cap);
      finalDeckResult.selected = selected;
    }
  } else {
    const fallbackPool = mergeUniqueById(candidates, pipelineSource).filter((item) => {
      if (removedByGateIds.has(item.card.id)) return false;
      if (unsafeIds.has(item.card.id)) return false;
      if (kidsFamily && isUnsafeForKids(item.card)) return false;
      return true;
    });
    selected = fallbackPool.slice(0, cap);
    finalDeckResult.selected = selected;
  }

  const diningUnsafe = demoteAlcoholFromTopForGeneralMealBrowse(selected, candidates, query);
  selected = diningUnsafe.next;
  if (isGeneralMealRestaurantBrowseQuery(query)) {
    console.log("[unsafe dining filter]", {
      query,
      removedUnsafeNames: diningUnsafe.removedUnsafeNames,
      selectedTop3: selected.slice(0, 3).map((x) => x.card.name),
    });
  }
  const beforeTop3FinalFastfood = selected.slice(0, 3).map((x) => x.card.name);
  const finalFastfood = applyFinalFastfoodGuardForGeneralMealBrowse(selected, candidates, query);
  selected = finalFastfood.next;
  if (isGeneralMealRestaurantBrowseQuery(query)) {
    console.log("[final fastfood guard]", {
      query,
      beforeTop3: beforeTop3FinalFastfood,
      nonFastFoodCount: finalFastfood.nonFastFoodCount,
      removedFastFoodNames: finalFastfood.removedFastFoodNames,
      afterTop3: selected.slice(0, 3).map((x) => x.card.name),
    });
  }
  const beforeTop3Recent = selected.slice(0, 3).map((x) => x.card.name);
  const beforeTop10Recent = selected.slice(0, 10).map((x) => x.card.name);
  const recentExposure = applyRecentExposureDiversity({
    selected,
    orderedCandidates: candidates,
    query,
    explicitCategory,
  });
  selected = recentExposure.next;
  if (isRecentExposureTargetQuery(query, explicitCategory)) {
    console.log("[recent exposure diversity]", {
      query,
      recentIds: recentExposure.recentIds,
      beforeTop3: beforeTop3Recent,
      afterTop3: selected.slice(0, 3).map((x) => x.card.name),
      replacedNames: recentExposure.replacedNames,
    });
  }
  const diversityRotation = applyRestaurantFinalDiversityRotation({
    selected,
    candidates,
    query,
    explicitCategory,
    explicitIntent: diagnostics?.explicitIntent ?? null,
    recentIds: recentExposure.recentIds,
  });
  selected = diversityRotation.next;

  // 다양성 교체 이후에도 안전 가드를 마지막에 한 번 더 적용한다.
  const diningUnsafePostRotation = demoteAlcoholFromTopForGeneralMealBrowse(selected, candidates, query);
  selected = diningUnsafePostRotation.next;
  const finalFastfoodPostRotation = applyFinalFastfoodGuardForGeneralMealBrowse(selected, candidates, query);
  selected = finalFastfoodPostRotation.next;

  console.log("[recommend fixed-result diagnosis]", {
    query,
    explicitIntent: diagnostics?.explicitIntent ?? null,
    explicitCategory: explicitCategory ?? null,
    fetchedCount: diagnostics?.fetchedCount ?? null,
    rankedPoolCount: diagnostics?.rankedPoolCount ?? null,
    safePoolCount: [...picked, ...allRanked]
      .filter((item, idx, arr) => arr.findIndex((x) => x.card.id === item.card.id) === idx)
      .filter((item) => {
        const kidsFamily = isKidsFamilyIntent(query, scenario);
        if (!kidsFamily) return true;
        return !isUnsafeForKids(item.card);
      }).length,
    gatedPoolCount: [...picked, ...allRanked]
      .filter((item, idx, arr) => arr.findIndex((x) => x.card.id === item.card.id) === idx)
      .filter((item) => {
        if (detectedIntent === "family_dining") {
          return !isBeautyLike(item.card) && !isCafeLike(item.card) && !isActivityLike(item.card) && !isDessertLike(item.card);
        }
        if (detectedIntent === "kids_meal") {
          return !isBeautyLike(item.card) && !isActivityLike(item.card);
        }
        if (detectedIntent === "kids_outing") {
          return !isBeautyLike(item.card);
        }
        return true;
      }).length,
    finalCandidatePoolCount: candidates.length,
    beforeRecentExposureTop10: beforeTop10Recent,
    recentExposureIds: recentExposure.recentIds,
    afterRecentExposureTop10: selected.slice(0, 10).map((x) => x.card.name),
    finalTop3: selected.slice(0, 3).map((x) => x.card.name),
  });
  if (isRestaurantDiagTargetQuery(query)) {
    console.log("[restaurant safety pool diagnosis]", {
      query,
      beforeGateCount: pipelineSource.length,
      afterGateCount: candidates.length,
      afterSafetyCount: selected.length,
      afterRecentExposureCount: selected.length,
      finalCandidatePoolCount: candidates.length,
      finalTop20: selected.slice(0, 20).map((x) => x.card.name),
      finalTop3: selected.slice(0, 3).map((x) => x.card.name),
    });
  }

  console.log("[recommend final deck constraint]", {
    query,
    detectedIntent,
    beforeFinalDeck,
    restaurantLikeCount: finalDeckResult.restaurantLikeCount,
    activityLikeCount: finalDeckResult.activityLikeCount,
    removedByFinalConstraint: finalDeckResult.removedByFinalConstraint,
    afterFinalDeck: selected.map((x) => x.card.name),
  });
  hamaDevLog("[HAMA_RESULTS] beforeFinalDeck:", beforeFinalDeck.length);
  hamaDevLog("[HAMA_RESULTS] afterFinalDeckConstraint:", selected.length);
  hamaDevLog("[HAMA_RESULTS] finalDeck:", selected.length);

  const fastFoodAfter = selected.filter((x) => detectFastFoodBrand(x.card)).length;
  const topAfter = selected.slice(0, cap).map((x) => x.card.name);
  if (detectedIntent === "family_dining") {
    console.log("[recommend family dining adjustment]", {
      query,
      detectedIntent,
      restaurantCandidates,
      cafeCandidates,
      fastFoodCandidates,
      topBefore,
      topAfter,
    });
  }
  if (detectedIntent !== "none") {
    console.log("[recommend hard gate]", {
      query,
      detectedIntent,
      removedByGate,
      topBefore: beforeGateTop,
      topAfter,
    });
  }
  console.log("[recommend fallback audit]", {
    query,
    intent: detectedIntent,
    fallbackUsed,
    fallbackSourcePoolSize: pipelineSource.length,
    reintroducedRemovedByGate: selected.some((x) => removedByGateIds.has(x.card.id)),
    reintroducedUnsafe: selected.some((x) => unsafeIds.has(x.card.id)),
    selectedNames: topAfter,
  });
  console.log("[recommend diversity shuffle]", {
    query,
    poolSize: candidates.length,
    selectedNames: topAfter,
  });
  if (detectedIntent !== "none") {
    console.log("[recommend intent fit adjustment]", {
      query,
      detectedIntent,
      topBefore,
      topAfter,
    });
    logEvent("recommend_intent_fit_adjusted", {
      query,
      detectedIntent,
    });
  }
  if (kidsFamily || removedNames.length > 0 || fastFoodBefore !== fastFoodAfter) {
    console.log("[recommend safety filter]", {
      query,
      intent: kidsFamily ? "kids_family" : "default",
      removedCount: removedNames.length,
      removedNames,
      fastFoodCountBefore: fastFoodBefore,
      fastFoodCountAfter: fastFoodAfter,
    });
    if (kidsFamily && removedNames.length > 0) {
      logEvent("recommend_safety_filter_applied", {
        query,
        removedCount: removedNames.length,
        reason: "kids_family_unsafe",
      });
    }
  }
  if (gateCat) {
    console.log("[recommend explicit category gate]", {
      query,
      explicitCategory: gateCat,
      beforeCount: explicitCategoryGateBefore,
      afterCount: pipelineSource.length,
      removedNames: explicitCategoryRemovedNames,
      finalTop3: selected.slice(0, 3).map((x) => x.card.name),
    });
    console.log("[recommend explicit category fallback]", {
      query,
      explicitCategory: gateCat,
      fallbackUsed,
      blockedFoodFallback: !selected.some((x) => isFoodLike(x.card) || isCafeLike(x.card)),
      selectedNames: selected.map((x) => x.card.name),
    });
  }
  return { deck: selected, recentExposureReplacements: recentExposure.replacedNames.length };
}

async function buildExpandedRankedPool(
  fetched: HomeCard[],
  ctx: {
    intent: IntentionType;
    userLat?: number | null;
    userLng?: number | null;
    excludeStoreIds?: string[];
    searchQuery?: string | null;
    scenarioObject?: ScenarioObject | null;
    userProfile?: UserProfile | null;
    relaxPersonalRules?: boolean;
  },
  targetSize = 50
): Promise<ScoredRecommendItem[]> {
  const rounds = Math.max(1, Math.ceil(targetSize / Math.max(1, RECOMMEND_DECK_SIZE)) + 4);
  const collected: ScoredRecommendItem[] = [];
  const excluded = new Set<string>((ctx.excludeStoreIds ?? []).filter(Boolean));
  for (let i = 0; i < rounds; i += 1) {
    const batch = buildTopRecommendations(fetched, {
      ...ctx,
      excludeStoreIds: Array.from(excluded),
    });
    if (!batch.length) break;
    let added = 0;
    for (const item of batch) {
      if (excluded.has(item.card.id)) continue;
      collected.push(item);
      excluded.add(item.card.id);
      added += 1;
      if (collected.length >= targetSize) break;
    }
    if (collected.length >= targetSize) break;
    if (added === 0) break;
  }
  return collected;
}

function mergeUserProfile(base: UserProfile | null, override: Partial<UserProfile> | null | undefined): UserProfile | null {
  if (!base && !override) return null;
  if (!base) return parseUserProfile(override);
  if (!override) return base;
  return {
    ...base,
    ...override,
    companions:
      override.companions != null && override.companions.length > 0 ? override.companions : base.companions,
    dietary_restrictions:
      override.dietary_restrictions != null && override.dietary_restrictions.length > 0
        ? override.dietary_restrictions
        : base.dietary_restrictions,
    interests: override.interests != null && override.interests.length > 0 ? override.interests : base.interests,
    gender: override.gender ?? base.gender,
    young_child: override.young_child ?? base.young_child,
    onboarding_completed_at: base.onboarding_completed_at,
  };
}

async function fetchRecommendPoolFallback(tab: HomeTabKey, count: number): Promise<HomeCard[]> {
  try {
    const res = await fetch(
      `/api/home-recommend?tab=${encodeURIComponent(tab)}&count=${encodeURIComponent(String(count))}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: StoreRow[] };
    const items = json.items ?? [];
    return items.map((row) => toHomeCard(row));
  } catch (e) {
    console.warn("[useHomeCards] home-recommend fallback failed", e);
    return [];
  }
}

function applyNamedFoodPresetScoreBoost(
  ranked: ScoredRecommendItem[],
  preset: NamedFoodPreset | null | undefined
): ScoredRecommendItem[] {
  if (!preset?.keywords?.length) return ranked;
  const scored = [...ranked].map((it) => {
    const bump = namedFoodPresetCompositeRankingBoost(it.card, preset);
    if (!bump) return it;
    return {
      ...it,
      breakdown: {
        ...it.breakdown,
        finalScore: Math.min(999, it.breakdown.finalScore + bump),
      },
    };
  });
  scored.sort((a, b) => {
    const d = b.breakdown.finalScore - a.breakdown.finalScore;
    if (Math.abs(d) > 1e-9) return d;
    return hashString(`${a.card.id}|nfp`) - hashString(`${b.card.id}|nfp`);
  });
  return reorderNamedFoodPresetRankingStrictPriority(scored, preset);
}

async function fetchNamedFoodPresetFallbackRestaurantCards(opts: {
  preset: NamedFoodPreset;
  excludeIds: ReadonlySet<string>;
  query: string | null | undefined;
  scenario: ScenarioObject | null | undefined;
}): Promise<HomeCard[]> {
  const seed = getOrCreateHamaSearchSeed();
  const headers: Record<string, string> = {};
  if (seed) headers["x-hama-search-seed"] = seed;
  const seen = new Set<string>();
  const out: HomeCard[] = [];

  const acceptTonkatsuRelaxedBroad = (c: HomeCard): boolean =>
    passesNamedFoodPresetFullCardGate(c, opts.preset, "broad") ||
    (opts.preset.id === "tonkatsu" && passesTonkatsuJapaneseRelaxGate(c));

  const tryTakeCard = (c: HomeCard) => {
    const id = String(c.id ?? "").trim();
    if (!id || opts.excludeIds.has(id) || seen.has(id)) return;
    if (!acceptTonkatsuRelaxedBroad(c)) return;
    seen.add(id);
    out.push(c);
  };

  for (const c of await fetchRestaurantOnlyFoodPresetCards({
    preset: opts.preset,
    phase: "broad",
    count: 450,
  })) {
    tryTakeCard(c);
  }
  if (opts.preset.id === "tonkatsu") {
    for (const c of await fetchRestaurantOnlyFoodPresetCards({
      preset: opts.preset,
      phase: "tonkatsu_relax",
      count: 420,
    })) {
      tryTakeCard(c);
    }
  }

  const keywordSearchListBase = [...opts.preset.keywords];
  const keywordHints =
    opts.preset.id === "tonkatsu" ? ([] as string[]).concat(keywordSearchListBase, ["일식집", "일식", "라멘"]) : keywordSearchListBase;
  const keywords = [...keywordHints].sort((a, b) => b.length - a.length);
  for (const kw of keywords) {
    if (out.length >= 52) break;
    const token = String(kw ?? "").trim();
    if (token.length < 2) continue;
    const url = `/api/stores/search-by-name?${new URLSearchParams({ q: token }).toString()}`;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: Object.keys(headers).length ? headers : undefined,
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { items?: StoreRow[] };
      for (const row of json.items ?? []) tryTakeCard(toHomeCard(row));
    } catch {
      /* ignore */
    }
  }

  return filterHomeCardsForScenarioSafety(out, opts.query ?? null, opts.scenario ?? null);
}

function guardNamedFoodPresetPickedDeck(
  picked: ScoredRecommendItem[],
  preset: NamedFoodPreset,
  query: string | null | undefined
): ScoredRecommendItem[] {
  const beforeCount = picked.length;
  const allowStrict = (it: ScoredRecommendItem): boolean =>
    isNamedFoodPresetRestaurantDbCategoryOnly(it.card) &&
    !blobFailsNamedFoodPresetHardExclude(it.card) &&
    passesNamedFoodPresetFinalRestaurantLabel(it.card) &&
    matchesNamedFoodPresetKeywords(it.card, preset, "strict");

  const afterRestaurantOnlyCount = picked.filter(
    (it) =>
      isNamedFoodPresetRestaurantDbCategoryOnly(it.card) && !blobFailsNamedFoodPresetHardExclude(it.card)
  ).length;

  let next = picked.filter(allowStrict);

  if (
    next.length === 0 &&
    beforeCount > 0 &&
    !isConservativeAccuracyFirstFoodPreset(preset)
  ) {
    next = picked.filter(
      (it) =>
        isNamedFoodPresetRestaurantDbCategoryOnly(it.card) &&
        !blobFailsNamedFoodPresetHardExclude(it.card) &&
        passesNamedFoodPresetFinalRestaurantLabel(it.card) &&
        (matchesNamedFoodPresetKeywords(it.card, preset, "broad") ||
          (preset.id === "tonkatsu" && passesTonkatsuJapaneseRelaxGate(it.card)))
    );
  }

  const afterKeywordMatchCount = next.length;
  const keptIds = new Set(next.map((x) => String(x.card.id ?? "").trim()));
  const removedNames = picked
    .filter((p) => !keptIds.has(String(p.card.id ?? "").trim()))
    .map((p) => p.card.name);
  const finalNames = next.map((p) => p.card.name);
  const strictMatchCount = next.filter((it) =>
    matchesNamedFoodPresetKeywords(it.card, preset, "strict")
  ).length;
  const broadMatchCount = next.filter(
    (it) =>
      matchesNamedFoodPresetKeywords(it.card, preset, "broad") &&
      !matchesNamedFoodPresetKeywords(it.card, preset, "strict")
  ).length;

  const guardPayload = {
    query: query ?? null,
    presetId: preset.id,
    subIntent: presetSubIntentLabel(preset),
    strictMatchCount,
    broadMatchCount,
    beforeCount,
    afterRestaurantOnlyCount,
    afterKeywordMatchCount,
    removedNames,
    finalNames,
  };
  hamaDevLog("[HAMA_FOOD_PRESET_GUARD]", guardPayload);

  return next;
}

type Result = {
  cards: HomeCard[];
  /**
   * 음식 명시 프리셋 결과에서 RecommendationList 안정 덱/context 동기화용 —
   * `presetId|searchAttempt|recentExposureSig`
   */
  deckRotationKey: string;
  /** 코스 생성 등 — 랭킹 전 후보 풀 */
  candidatePool: HomeCard[];
  /** intentType course_generation 시 — 탭과 무관한 역할별 혼합 풀(식사/카페/액티비티) */
  courseCandidatePool: HomeCard[];
  isLoading: boolean;
  /** RECOMMEND_DECK_SIZE 미만이면 완화 랭킹·후보 부족 등 */
  deckIncomplete: boolean;
};

export type UseHomeCardsOptions = {
  userLat?: number | null;
  userLng?: number | null;
  /** 홈 검색창 입력 — 키워드 점수 보조용(가중치 낮음) */
  searchQuery?: string | null;
  /** parseScenarioIntent 결과 — 랭킹·배지·코스 공통 */
  scenarioObject?: ScenarioObject | null;
  /** TODO: 최근 본 전체 제외는 RECENT_EXCLUDE_LIMIT 으로만 사용 (확장 시 서버 동기화) */
  excludeStoreIds?: string[];
  /**
   * true 이면 페치/랭킹을 하지 않고 로비만 유지.
   * 위치·최근 목록 확정 전에 한 번만 랭킹하도록 할 때 사용(중간에 카드 갈아끼움 방지).
   */
  deferRanking?: boolean;
  /**
   * true 이면 추천·코스 후보 페치를 아예 하지 않음.
   * Results: 매장명 검색이 이미 성공한 경우 뒤쪽 추천 로직이 화면/상태를 덮어쓰지 않게 할 때 사용.
   */
  skipFetch?: boolean;
  /** 메인 추천 거절 등 — 해당 매장 id 는 재랭킹에서 제외 */
  rejectedMainPickIds?: string[];
  /**
   * 일회성 프로필 보정(결과 화면 칩/자유입력).
   * DB의 user_profile 은 바꾸지 않고 랭킹/카피에만 반영.
   */
  profileOverride?: Partial<UserProfile> | null;
  /** 식단 등 개인화 하드필터만 완화(랭킹은 유지) */
  relaxPersonalRules?: boolean;
  /** 홈 퀵 카테고리 등 URL `intent` — 로그·랭킹 보조(쿼리 파싱과 병행) */
  explicitIntent?: string | null;
  /** URL `category` — 후보 풀 fetch 탭 힌트(`explicitCategoryToFetchTab`) */
  explicitCategory?: string | null;
  /** URL `mode` — 예: `course` 이면 코스 후보 풀 페치 */
  explicitMode?: string | null;
  /** 직접 음식어 검색(/results 등) 프리셋 매칭 — 레스토랑 우선·랭킹 보강에 사용 */
  namedFoodPreset?: NamedFoodPreset | null;
  /** 프리셋 덱 크기 상한 (3~5) */
  recommendedDeckCap?: number;
};

/**
 * 홈 추천 카드 — 후보 풀 fetch 후 클라이언트에서 결정론적 점수화
 * TODO(Supabase user_actions): 클릭/체류 데이터로 재랭킹 파이프라인 연결
 */
export function useHomeCards(
  tab: HomeTabKey,
  shuffleKey: number,
  intent: IntentionType,
  options: UseHomeCardsOptions = {}
): Result {
  const [cards, setCards] = useState<HomeCard[]>([]);
  const [deckRotationKey, setDeckRotationKey] = useState("");
  const [pool, setPool] = useState<HomeCard[]>([]);
  const [coursePool, setCoursePool] = useState<HomeCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deckIncomplete, setDeckIncomplete] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const excludeMerged = [
    ...new Set(
      [
        ...(options.excludeStoreIds ?? []),
        ...(options.rejectedMainPickIds ?? []),
        ...(options.scenarioObject?.conversationExcludePlaceIds ?? []),
      ].filter(Boolean)
    ),
  ];
  const excludeKey = excludeMerged.join("|");
  const scenarioKey = options.scenarioObject
    ? `${options.scenarioObject.scenario}:${options.scenarioObject.intentType}:${options.scenarioObject.recommendationMode ?? ""}:${options.scenarioObject.intentCategory ?? ""}:${options.scenarioObject.foodSubCategory ?? ""}:${(options.scenarioObject.menuIntent ?? []).join(",")}:${(options.scenarioObject.foodPreference ?? []).join("|")}:${(options.scenarioObject.vibePreference ?? []).join("|")}:${(options.scenarioObject.hardConstraints ?? []).join("|")}:${options.scenarioObject.timeOfDay ?? ""}:${options.scenarioObject.distanceTolerance ?? ""}:${options.scenarioObject.parkingPreferred ? "p" : ""}:${(options.scenarioObject.conversationRejectedFoodSubs ?? []).join("|")}:${(options.scenarioObject.conversationExcludeMenuTerms ?? []).join("|")}:${options.scenarioObject.confidence ?? ""}`
    : "";

  const deferRanking = options.deferRanking === true;
  const skipFetch = options.skipFetch === true;
  const relaxPersonalRules = options.relaxPersonalRules === true;
  const profileOverrideKey = options.profileOverride
    ? JSON.stringify(options.profileOverride)
    : "";
  const explicitKey = `${options.explicitIntent ?? ""}|${options.explicitCategory ?? ""}|${options.explicitMode ?? ""}|${options.namedFoodPreset?.id ?? ""}|${options.recommendedDeckCap ?? ""}`;

  const effectiveUserProfile = useMemo(() => {
    return mergeUserProfile(userProfile ?? null, options.profileOverride ?? null);
  }, [userProfile, profileOverrideKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/users/me/profile", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setUserProfile(parseUserProfile(json?.user_profile));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const hookCheckPayload = {
      deferRanking,
      skipFetch,
      searchQuery: options.searchQuery,
      namedFoodPreset: options.namedFoodPreset,
      presetId: options.namedFoodPreset?.id,
    };
    hamaDevLog("[HAMA_FOOD_PRESET_HOOK_CHECK]", hookCheckPayload);

    if (skipFetch) {
      setCards([]);
      setDeckRotationKey("");
      setPool([]);
      setCoursePool([]);
      setIsLoading(false);
      setDeckIncomplete(false);
      return;
    }

    if (deferRanking) {
      setIsLoading(true);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      try {
        const so = options.scenarioObject;
        console.log("[useHomeCards input compare]", {
          searchQuery: options.searchQuery ?? null,
          explicitIntent: options.explicitIntent ?? null,
          explicitCategory: options.explicitCategory ?? null,
          explicitMode: options.explicitMode ?? null,
          scenarioObject: so
            ? {
                scenario: so.scenario,
                intentType: so.intentType,
                recommendationMode: so.recommendationMode,
                intentCategory: so.intentCategory,
              }
            : null,
        });

        const scenarioObj = options.scenarioObject;
        const wantCourse =
          (scenarioObj?.recommendationMode ?? (scenarioObj?.intentType === "course_generation" ? "course" : "single")) ===
            "course" || options.explicitMode === "course";
        const strict =
          scenarioObj?.intentType === "search_strict" && scenarioObj.intentCategory != null;

        const strictTab =
          strict && scenarioObj?.intentCategory ? intentCategoryToHomeTab(scenarioObj.intentCategory) : null;
        const explicitTab =
          !strictTab && options.explicitCategory ? explicitCategoryToFetchTab(options.explicitCategory) : null;
        const gateCatRun = normalizeStrictExplicitGateCategory(options.explicitCategory);

        console.log("[recommend explicit hints]", {
          query: options.searchQuery ?? null,
          explicitIntent: options.explicitIntent ?? null,
          explicitCategory: options.explicitCategory ?? null,
          explicitMode: options.explicitMode ?? null,
        });

        const exCatLower = (options.explicitCategory ?? "").trim().toLowerCase();
        const explicitIntentLower = (options.explicitIntent ?? "").trim().toLowerCase();
        const isExplicitOrStrictCafe =
          exCatLower === "cafe" || strictTab === "cafe" || explicitTab === "cafe";

        let fetchTabsTried: string[] = [];
        let recoveredFromTab: string | null = null;
        const countsByTab: Record<string, number> = {};
        let allFetchLastCount: number | null = null;
        /** 문화+박물관 직접 모드 로그용(힌트/앵커 건수) */
        let cultureMuseumDiag: { hintCount: number; anchorCount: number } | null = null;
        /** 푸드/식당/맛집 browse·final 가드용 통합 풀(필요 시 all 탭까지 merge) */
        let genericFoodMergedPool: HomeCard[] | null = null;
        const preset = getSituationQueryPreset(options.searchQuery ?? null);
        const searchAttempt = bumpAndReadSearchAttemptForQuery(options.searchQuery ?? "");
        const namedFoodPresetForAttemptLog = options.namedFoodPreset ?? null;
        if (namedFoodPresetForAttemptLog) {
          hamaDevLog("[HAMA_NAMED_FOOD_SEARCH_ATTEMPT]", {
            query: options.searchQuery ?? null,
            searchAttempt,
            presetId: namedFoodPresetForAttemptLog.id,
          });
        }
        const scenarioBeautyBlockActive =
          shouldBlockBeautySalonForListedScenarioQueries(options.searchQuery ?? null);
        const exposureLogState = {
          excludedByRecentCount: 0,
          candidateCountBefore: 0,
          candidateCountAfter: 0,
          recentExposureReplacements: 0,
        };

        const courseFetched = wantCourse ? await fetchHomeCourseCandidatePool() : [];

        let fetchedRaw: HomeCard[] = [];
        const applySituationPresetEnrichment = async (base: HomeCard[]): Promise<HomeCard[]> => {
          if (!preset) return base;
          const presetFetchedByCategory = await fetchHomeCardsByStoreCategories(preset.categories, {
            count: RECOMMEND_POOL_SINGLE_TAB,
          });
          // category-first pool
          let merged = mergeHomeCardsUniqueById(base, presetFetchedByCategory);
          // keyword OR pool (name/tags/mood/category/description blob)
          let keywordPoolFromAll: HomeCard[] = [];
          if (merged.length < 3) {
            const allRows = await fetchHomeRecommendCandidates("all");
            keywordPoolFromAll = allRows.filter((card) => {
              const b = normalizeBlob(card);
              return preset.keywords.some((kw) => b.includes(String(kw).toLowerCase()));
            });
            merged = mergeHomeCardsUniqueById(merged, keywordPoolFromAll);
          }
          const withKeywords = merged.filter((card) => {
            const b = normalizeBlob(card);
            return preset.keywords.some((kw) => b.includes(String(kw).toLowerCase()));
          });
          const pool = withKeywords.length >= 3 ? withKeywords : merged;
          const kidsFamily = /아이|가족|키즈/.test(normalizeBrandQuery(String(options.searchQuery ?? "")));
          const safePool = kidsFamily ? pool.filter((card) => !isUnsafeForKids(card)) : pool;
          const shuffled = shuffleCardsBySeed(
            safePool,
            `${options.searchQuery ?? ""}|situation_preset|${getOrCreateHamaSearchSeed()}|a${searchAttempt}|t${(String(Date.now() % 1000000)).padStart(6, "0")}`
          );
          const fallbackMatchedCount = withKeywords.length;
          hamaDevLog("[HAMA_SEARCH] fallbackQueryMode:", "category/tags/mood/name");
          hamaDevLog("[HAMA_SEARCH] fallbackMatchedCount:", fallbackMatchedCount);
          console.log("[situation query preset enrichment]", {
            query: options.searchQuery ?? null,
            presetCategories: preset.categories,
            presetKeywords: preset.keywords,
            baseCount: base.length,
            presetFetchedCount: presetFetchedByCategory.length,
            keywordPoolFromAllCount: keywordPoolFromAll.length,
            mergedCount: merged.length,
            keywordMatchedCount: withKeywords.length,
            finalPoolCount: shuffled.length,
            sampleNames: shuffled.slice(0, 12).map((c) => c.name),
          });
          return shuffled;
        };

        if (strictTab) {
          fetchTabsTried.push(`strict:${strictTab}`);
          fetchedRaw = await fetchHomeCardsByTab(strictTab, { count: RECOMMEND_POOL_SINGLE_TAB });
          countsByTab[strictTab] = fetchedRaw.length;
        } else if (exCatLower === "culture") {
          fetchTabsTried.push("museum");
          const museumRows = await fetchHomeCardsByTab("museum", { count: RECOMMEND_POOL_SINGLE_TAB });
          countsByTab.museum = museumRows.length;
          fetchTabsTried.push("activity");
          const activityRows = await fetchHomeCardsByTab("activity", { count: RECOMMEND_POOL_SINGLE_TAB });
          countsByTab.activity = activityRows.length;
          const activityCulture = activityRows.filter((c) => isCultureLike(c));
          countsByTab.activity_culture_slice = activityCulture.length;
          fetchedRaw = mergeHomeCardsUniqueById(museumRows, activityCulture);
          recoveredFromTab = "museum+activity_culture_slice";
          if (fetchedRaw.length < 12) {
            fetchTabsTried.push("all");
            const allRows = await fetchHomeRecommendCandidates("all");
            allFetchLastCount = allRows.length;
            countsByTab.all = allRows.length;
            countsByTab.all_culture_like = allRows.filter((c) => isCultureLike(c)).length;
            fetchedRaw = mergeHomeCardsUniqueById(
              fetchedRaw,
              allRows.filter((c) => isCultureLike(c))
            );
            recoveredFromTab = "museum+activity+all_culture_slice";
          }
          const qNormCulture = String(options.searchQuery ?? "").trim().toLowerCase();
          const useDirectMuseumMode = qNormCulture === "박물관" || qNormCulture.includes("박물관");
          if (useDirectMuseumMode) {
            fetchTabsTried.push("culture:search_by_name_api");
            const apiHits = await fetchMuseumCardsViaSearchByNameApi("박물관");
            countsByTab.culture_search_by_name_api = apiHits.length;
            fetchedRaw = mergeHomeCardsUniqueById(fetchedRaw, apiHits);
            recoveredFromTab = `${recoveredFromTab ?? "culture"}+search_by_name_api`;
            const anchorFromApi = apiHits.filter((c) => hasCultureAnchor(c) && !cultureRescueSoftBlock(c));
            cultureMuseumDiag = { hintCount: apiHits.length, anchorCount: anchorFromApi.length };
          }
        } else if (explicitTab) {
          fetchTabsTried.push(`explicit:${explicitTab}`);
          fetchedRaw = await fetchHomeCardsByTab(explicitTab, { count: RECOMMEND_POOL_SINGLE_TAB });
          countsByTab[explicitTab] = fetchedRaw.length;
        } else {
          fetchTabsTried.push("homeRecommend");
          fetchedRaw = await fetchHomeRecommendCandidates(tab);
          countsByTab[`recommendMix:${tab}`] = fetchedRaw.length;
        }

        /** URL q-only `박물관` 등 — explicit culture 탭이 아닐 때도 매장명 API와 동일 후보를 추천 풀에 합류 */
        const museumSingleToken = String(options.searchQuery ?? "").trim() === "박물관";
        if (
          museumSingleToken &&
          !strictTab &&
          !explicitTab &&
          exCatLower !== "culture" &&
          exCatLower !== "cafe" &&
          exCatLower !== "beauty" &&
          exCatLower !== "restaurant" &&
          exCatLower !== "fitness" &&
          exCatLower !== "life"
        ) {
          fetchTabsTried.push("museum_single_token:search_by_name_api");
          const apiHits = await fetchMuseumCardsViaSearchByNameApi("박물관");
          countsByTab.museum_single_token_api = apiHits.length;
          fetchedRaw = mergeHomeCardsUniqueById(fetchedRaw, apiHits);
        }

        if (preset && fetchedRaw.length < 3) {
          fetchedRaw = await applySituationPresetEnrichment(fetchedRaw);
        }

        if (cancelled) return;

        if (!fetchedRaw.length && (strictTab || explicitTab) && exCatLower !== "culture") {
          const apiTab: HomeTabKey = strictTab ?? explicitTab ?? tab;
          fetchTabsTried.push(`fallback:${apiTab}`);
          fetchedRaw = await fetchRecommendPoolFallback(apiTab, RECOMMEND_POOL_SINGLE_TAB);
          countsByTab[`fallbackApi:${apiTab}`] = fetchedRaw.length;
        }
        if (!fetchedRaw.length && (strictTab || explicitTab) && !gateCatRun && exCatLower !== "culture") {
          fetchTabsTried.push("fallback:all");
          fetchedRaw = await fetchRecommendPoolFallback("all", 48);
          countsByTab["fallbackApi:all"] = fetchedRaw.length;
        }

        if (isExplicitOrStrictCafe) {
          const cafeish = (c: HomeCard) => isCafeLike(c) || isDessertLike(c);
          if (!fetchedRaw.length || fetchedRaw.filter(cafeish).length < 4) {
            fetchTabsTried.push("cafe_enrich:all");
            const allRows = await fetchHomeRecommendCandidates("all");
            allFetchLastCount = allRows.length;
            countsByTab.all_cafe_enrich_total = allRows.length;
            countsByTab.all_cafe_enrich_cafeish = allRows.filter(cafeish).length;
            fetchedRaw = mergeHomeCardsUniqueById(fetchedRaw, allRows.filter(cafeish));
            recoveredFromTab = recoveredFromTab ?? "cafe_merge_all_cafeish";
          }
        }

        if (exCatLower === "beauty") {
          const beautyish = (c: HomeCard) => isBeautyLike(c);
          if (!fetchedRaw.length || fetchedRaw.filter(beautyish).length < 6) {
            fetchTabsTried.push("beauty_enrich:salon");
            const salonRows = await fetchHomeCardsByTab("salon", { count: RECOMMEND_POOL_SINGLE_TAB });
            countsByTab.salon_beauty_enrich = salonRows.length;
            fetchTabsTried.push("beauty_enrich:all");
            const allRows = await fetchHomeRecommendCandidates("all");
            allFetchLastCount = allRows.length;
            countsByTab.all_beauty_enrich_total = allRows.length;
            countsByTab.all_beauty_enrich_beautyish = allRows.filter(beautyish).length;
            fetchedRaw = mergeHomeCardsUniqueById(
              fetchedRaw,
              mergeHomeCardsUniqueById(salonRows, allRows.filter(beautyish))
            );
            recoveredFromTab = recoveredFromTab ?? "beauty_salon_all";
          }
          if (explicitIntentLower === "beauty_hair") {
            const pref = fetchedRaw.filter((c) => isBeautyHairPreferredCandidate(c));
            const rest = fetchedRaw.filter((c) => !pref.some((p) => p.id === c.id));
            fetchedRaw = [...pref, ...rest];
          }
        }

        let restaurantTabOnlyCount: number | null = null;
        if (explicitTab === "restaurant" || strictTab === "restaurant") {
          restaurantTabOnlyCount = fetchedRaw.length;
        }

        const foodPoolExplore =
          exCatLower === "restaurant" ||
          explicitIntentLower === "food_general" ||
          strictTab === "restaurant";

        if (foodPoolExplore && !options.namedFoodPreset) {
          const allRowsFood = await fetchHomeRecommendCandidates("all");
          allFetchLastCount = allRowsFood.length;
          const foodSlurp = (c: HomeCard) =>
            (isFoodLike(c) || isRestaurantLike(c)) && !isCafeLike(c) && !isBeautyLike(c);
          const allRestaurantLike = allRowsFood.filter(foodSlurp);
          fetchedRaw = mergeHomeCardsUniqueById(fetchedRaw, allRestaurantLike);
          if (isRestaurantDiagTargetQuery(options.searchQuery ?? null)) {
            console.log("[restaurant all merge diagnosis]", {
              query: options.searchQuery ?? null,
              allFetchedCount: allRowsFood.length,
              restaurantLikeFromAllCount: allRestaurantLike.length,
              mergedFoodPoolCount: fetchedRaw.filter((c) => isRestaurantLike(c)).length,
              mergedNamesTop50: fetchedRaw
                .filter((c) => isRestaurantLike(c))
                .slice(0, 50)
                .map((c) => c.name),
            });
          }
        }

        if (scenarioBeautyBlockActive) {
          fetchedRaw = fetchedRaw.filter((c) => !homeCardMatchesScenarioBeautySalonBlock(c));
        }
        fetchedRaw = filterHomeCardsForScenarioSafety(
          fetchedRaw,
          options.searchQuery ?? null,
          options.scenarioObject ?? null
        );

        const fetchedPreGate = fetchedRaw;
        hamaDevLog("[HAMA_RESULTS] rawFetchedCards.length:", fetchedPreGate.length);
        if (isRestaurantDiagTargetQuery(options.searchQuery ?? null)) {
          const restaurantLikeRows = fetchedPreGate.filter((c) => isRestaurantLike(c));
          const countsByCategory = restaurantLikeRows.reduce<Record<string, number>>((acc, card) => {
            const key = String(card.category ?? "unknown");
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {});
          const countsByArea = restaurantLikeRows.reduce<Record<string, number>>((acc, card) => {
            const key = String(card.area ?? "unknown");
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {});
          const withLatLngCount = restaurantLikeRows.filter(
            (c) => typeof c.lat === "number" && typeof c.lng === "number"
          ).length;
          const withoutLatLngCount = Math.max(0, restaurantLikeRows.length - withLatLngCount);
          console.log("[restaurant db pool diagnosis]", {
            query: options.searchQuery ?? null,
            knownDbRestaurantCount: 284,
            categoriesForRestaurantTab: categoriesForHomeTab("restaurant"),
            fetchedRestaurantTabCount: restaurantTabOnlyCount,
            allFetchedCount: allFetchLastCount,
            restaurantLikeFromAllCount: fetchedRaw.filter((c) => isRestaurantLike(c)).length,
            withLatLngCount,
            withoutLatLngCount,
            countsByCategory,
            countsByArea,
            sampleNames: restaurantLikeRows.slice(0, 30).map((c) => c.name),
          });
          console.log("[restaurant fetch diagnosis]", {
            query: options.searchQuery ?? null,
            fetchTab: strictTab ?? explicitTab ?? tab,
            categoriesForTab: categoriesForHomeTab("restaurant"),
            fetchedCount: restaurantLikeRows.length,
            fetchedNamesTop50: restaurantLikeRows.slice(0, 50).map((c) => c.name),
            fetchLimit: RECOMMEND_POOL_SINGLE_TAB,
            hasDistanceFilter: false,
            maxDistanceKm: null,
          });
        }
        const afterMatcherCount =
          exCatLower === "culture"
            ? fetchedPreGate.filter((c) => isCultureLike(c) || hasCultureAnchor(c)).length
            : isExplicitOrStrictCafe
              ? fetchedPreGate.filter((c) => isCafeLike(c) || isDessertLike(c)).length
              : exCatLower === "beauty"
                ? fetchedPreGate.filter((c) => isBeautyLike(c)).length
                : fetchedPreGate.length;

        let sampleRejectedNames: string[] = [];
        let fetched = fetchedPreGate;
        let afterExplicitGateCount = fetched.length;
        if (gateCatRun) {
          sampleRejectedNames = fetched
            .filter((c) => !passesExplicitCategoryDeck(c, gateCatRun))
            .slice(0, 12)
            .map((c) => c.name);
          fetched = fetched.filter((c) => passesExplicitCategoryDeck(c, gateCatRun));
          afterExplicitGateCount = fetched.length;
        }
        hamaDevLog("[HAMA_RESULTS] enrichedCards.length:", fetched.length);

        if (options.namedFoodPreset && !cancelled) {
          const presetRef = options.namedFoodPreset;
          const conservativeAccuracy = isConservativeAccuracyFirstFoodPreset(presetRef);
          const basePool = fetched
            .filter(isNamedFoodPresetRestaurantDbCategoryOnly)
            .filter((c) => !blobFailsNamedFoodPresetHardExclude(c));
          let pool = basePool.filter((c) => passesNamedFoodPresetFullCardGate(c, presetRef, "strict"));
          if (!conservativeAccuracy && pool.length < 10) {
            pool = basePool.filter((c) => passesNamedFoodPresetFullCardGate(c, presetRef, "broad"));
          }
          if (presetRef.id === "tonkatsu" && pool.length === 0) {
            pool = basePool.filter((c) => passesTonkatsuJapaneseRelaxGate(c));
          }
          if (!conservativeAccuracy && (pool.length < 8 || basePool.length < 16) && !cancelled) {
            const repoPhase =
              presetRef.id === "tonkatsu" && pool.length === 0 ? ("tonkatsu_relax" as const) : ("broad" as const);
            const fromRepo = await fetchRestaurantOnlyFoodPresetCards({
              preset: presetRef,
              phase: repoPhase,
              count: 480,
            });
            const merged = mergeHomeCardsUniqueById(basePool, fromRepo);
            pool =
              repoPhase === "tonkatsu_relax"
                ? merged.filter((c) => passesTonkatsuJapaneseRelaxGate(c))
                : merged.filter((c) => passesNamedFoodPresetFullCardGate(c, presetRef, "broad"));
          }
          fetched = pool;
        }

        const rankScenario = scenarioForHomeCardsRanking(
          options.scenarioObject ?? null,
          options.explicitIntent ?? null
        );

        const ctx = {
          intent,
          userLat: options.userLat,
          userLng: options.userLng,
          excludeStoreIds: excludeMerged,
          searchQuery: options.searchQuery,
          scenarioObject: rankScenario,
          userProfile: effectiveUserProfile,
          relaxPersonalRules,
        };

        const namedFoodPresetOpt = options.namedFoodPreset ?? null;
        const deckCapDiag =
          namedFoodPresetOpt != null
            ? Math.min(5, Math.max(3, options.recommendedDeckCap ?? 5))
            : undefined;
        const namedFoodDeckBucketOpts =
          namedFoodPresetOpt != null && deckCapDiag != null ?
            ({ deckTarget: deckCapDiag, namedFoodPreset: namedFoodPresetOpt } as const)
          : undefined;

        let rankedPrimary = await buildExpandedRankedPool(fetched, ctx, 50);
        rankedPrimary = applyNamedFoodPresetScoreBoost(rankedPrimary, namedFoodPresetOpt);
        if (isRestaurantDiagTargetQuery(options.searchQuery ?? null)) {
          const top30 = rankedPrimary.slice(0, 30);
          console.log("[restaurant ranking diagnosis]", {
            query: options.searchQuery ?? null,
            rankedPoolCount: rankedPrimary.length,
            top30NamesWithScores: top30.map((x) => ({
              name: x.card.name,
              category: x.card.category,
              area: x.card.area,
              distanceKm: x.card.distanceKm,
              finalScore: x.breakdown.finalScore,
              tags: x.card.tags,
              mood: x.card.mood,
              breakdown: x.breakdown,
            })),
          });
          console.log("[restaurant distance diagnosis]", {
            query: options.searchQuery ?? null,
            top30: top30.map((x) => ({
              name: x.card.name,
              distanceKm: x.card.distanceKm,
              finalScore: x.breakdown.finalScore,
            })),
          });
        }
        let foodDiversityMeta: {
          poolSize: number;
          beforeShuffle: string[];
          afterShuffle: string[];
        } | null = null;
        if (shouldShuffleExplicitFoodPool(options)) {
          const { list, beforeSliceNames, afterSliceNames } = shuffleFoodRestaurantTopSlice(rankedPrimary, {
            q: options.searchQuery ?? null,
            explicitCategory: options.explicitCategory ?? null,
            explicitIntent: options.explicitIntent ?? null,
          });
          rankedPrimary = list;
          foodDiversityMeta = {
            poolSize: rankedPrimary.length,
            beforeShuffle: beforeSliceNames,
            afterShuffle: afterSliceNames,
          };
        }
        if (namedFoodPresetOpt) {
          rankedPrimary = applyNamedFoodSearchAttemptScoreBandShuffle(rankedPrimary, {
            query: options.searchQuery ?? "",
            presetId: namedFoodPresetOpt.id,
            searchAttempt,
          });
        }
        const rankedFallback = await buildExpandedRankedPool(fetched, {
          ...ctx,
          excludeStoreIds: [],
        }, 50);
        let rankedFallbackBoosted = applyNamedFoodPresetScoreBoost(rankedFallback, namedFoodPresetOpt);
        if (namedFoodPresetOpt) {
          rankedFallbackBoosted = applyNamedFoodSearchAttemptScoreBandShuffle(rankedFallbackBoosted, {
            query: options.searchQuery ?? "",
            presetId: namedFoodPresetOpt.id,
            searchAttempt,
          });
        }
        let fallbackCandidates = [...rankedPrimary, ...rankedFallbackBoosted].filter(
          (item, idx, arr) => arr.findIndex((x) => x.card.id === item.card.id) === idx
        );
        let cultureGuardCandidates: ScoredRecommendItem[] =
          scenarioBeautyBlockActive ?
            fallbackCandidates.filter((item) => !homeCardMatchesScenarioBeautySalonBlock(item.card))
          : fallbackCandidates;
        cultureGuardCandidates = filterScoredRecommendItemsForScenarioSafety(
          cultureGuardCandidates,
          options.searchQuery ?? null,
          options.scenarioObject ?? null
        );
        exposureLogState.candidateCountBefore = fallbackCandidates.length;
        exposureLogState.candidateCountAfter = fallbackCandidates.length;
        hamaDevLog("[HAMA_RESULTS] fallbackCandidates.length:", fallbackCandidates.length);
        let safetyDiversityOutcome = applySafetyAndDiversity(
          rankedPrimary,
          rankedFallbackBoosted,
          options.searchQuery ?? null,
          rankScenario,
          options.explicitCategory ?? null,
          {
            explicitIntent: options.explicitIntent ?? null,
            fetchedCount: fetched.length,
            rankedPoolCount: rankedPrimary.length,
            searchAttempt,
            ...(deckCapDiag != null ? { deckCap: deckCapDiag } : {}),
            ...(namedFoodPresetOpt ? { namedFoodPresetId: namedFoodPresetOpt.id } : {}),
          }
        );
        let picked = safetyDiversityOutcome.deck;
        exposureLogState.recentExposureReplacements = safetyDiversityOutcome.recentExposureReplacements;

        if (preset && picked.length < 3 && !options.namedFoodPreset) {
          const enrichedFetched = await applySituationPresetEnrichment(fetched);
          if (enrichedFetched.length > fetched.length) {
            fetched = enrichedFetched;
            rankedPrimary = await buildExpandedRankedPool(fetched, ctx, 50);
            rankedPrimary = applyNamedFoodPresetScoreBoost(rankedPrimary, namedFoodPresetOpt);
            const rankedFallbackRetry = applyNamedFoodPresetScoreBoost(
              await buildExpandedRankedPool(fetched, { ...ctx, excludeStoreIds: [] }, 50),
              namedFoodPresetOpt
            );
            safetyDiversityOutcome = applySafetyAndDiversity(
              rankedPrimary,
              rankedFallbackRetry,
              options.searchQuery ?? null,
              rankScenario,
              options.explicitCategory ?? null,
              {
                explicitIntent: options.explicitIntent ?? null,
                fetchedCount: fetched.length,
                rankedPoolCount: rankedPrimary.length,
                searchAttempt,
                ...(deckCapDiag != null ? { deckCap: deckCapDiag } : {}),
                ...(namedFoodPresetOpt ? { namedFoodPresetId: namedFoodPresetOpt.id } : {}),
              }
            );
            picked = safetyDiversityOutcome.deck;
            exposureLogState.recentExposureReplacements = safetyDiversityOutcome.recentExposureReplacements;
          }
        }

        if (
          namedFoodPresetOpt &&
          picked.length < 3 &&
          !cancelled &&
          !isConservativeAccuracyFirstFoodPreset(namedFoodPresetOpt)
        ) {
          const extraFood = await fetchNamedFoodPresetFallbackRestaurantCards({
            preset: namedFoodPresetOpt,
            excludeIds: new Set(picked.map((x) => x.card.id)),
            query: options.searchQuery ?? null,
            scenario: rankScenario ?? options.scenarioObject ?? null,
          });
          if (extraFood.length && !cancelled) {
            fetched = mergeHomeCardsUniqueById(fetched, extraFood);
            rankedPrimary = await buildExpandedRankedPool(fetched, ctx, 50);
            rankedPrimary = applyNamedFoodPresetScoreBoost(rankedPrimary, namedFoodPresetOpt);
            if (shouldShuffleExplicitFoodPool(options)) {
              rankedPrimary = shuffleFoodRestaurantTopSlice(rankedPrimary, {
                q: options.searchQuery ?? null,
                explicitCategory: options.explicitCategory ?? null,
                explicitIntent: options.explicitIntent ?? null,
              }).list;
            }
            if (namedFoodPresetOpt) {
              rankedPrimary = applyNamedFoodSearchAttemptScoreBandShuffle(rankedPrimary, {
                query: options.searchQuery ?? "",
                presetId: namedFoodPresetOpt.id,
                searchAttempt,
              });
            }
            let rankedFbFood = applyNamedFoodPresetScoreBoost(
              await buildExpandedRankedPool(fetched, { ...ctx, excludeStoreIds: [] }, 50),
              namedFoodPresetOpt
            );
            if (namedFoodPresetOpt) {
              rankedFbFood = applyNamedFoodSearchAttemptScoreBandShuffle(rankedFbFood, {
                query: options.searchQuery ?? "",
                presetId: namedFoodPresetOpt.id,
                searchAttempt,
              });
            }
            fallbackCandidates = [...rankedPrimary, ...rankedFbFood].filter(
              (item, idx, arr) => arr.findIndex((x) => x.card.id === item.card.id) === idx
            );
            cultureGuardCandidates = scenarioBeautyBlockActive ?
                fallbackCandidates.filter((item) => !homeCardMatchesScenarioBeautySalonBlock(item.card))
              : fallbackCandidates;
            cultureGuardCandidates = filterScoredRecommendItemsForScenarioSafety(
              cultureGuardCandidates,
              options.searchQuery ?? null,
              options.scenarioObject ?? null
            );
            safetyDiversityOutcome = applySafetyAndDiversity(
              rankedPrimary,
              rankedFbFood,
              options.searchQuery ?? null,
              rankScenario,
              options.explicitCategory ?? null,
              {
                explicitIntent: options.explicitIntent ?? null,
                fetchedCount: fetched.length,
                rankedPoolCount: rankedPrimary.length,
                searchAttempt,
                ...(deckCapDiag != null ? { deckCap: deckCapDiag } : {}),
                ...(namedFoodPresetOpt ? { namedFoodPresetId: namedFoodPresetOpt.id } : {}),
              }
            );
            picked = safetyDiversityOutcome.deck;
            exposureLogState.recentExposureReplacements = safetyDiversityOutcome.recentExposureReplacements;
          }
        }

        const cultureMuseumQuery = /박물관/i.test(String(options.searchQuery ?? "").trim());

        console.log("[category pipeline drop point]", {
          query: options.searchQuery ?? null,
          explicitCategory: options.explicitCategory ?? null,
          explicitIntent: options.explicitIntent ?? null,
          fetchTabsTried,
          countsByTab,
          fetchedCount: fetchedPreGate.length,
          rankedPoolCount: rankedPrimary.length,
          afterMatcherCount,
          afterGateCount: afterExplicitGateCount,
          finalDeckCount: picked.length,
          sampleFetchedNames: fetchedPreGate.slice(0, 10).map((c) => c.name),
          sampleRejectedNames,
        });

        if (
          picked.length === 0 &&
          (exCatLower === "cafe" || exCatLower === "beauty" || exCatLower === "culture")
        ) {
          let browseMode: "cafe" | "beauty" | "culture" | null = null;
          let browseSorted: HomeCard[] = [];
          let browseSourceNote = "";
          let cultureRecoveryCounts: { fromPre: number; fromAct: number; fromAll: number } | null = null;
          let cultureHintCardsForRescue: HomeCard[] = [];
          let cultureHintMeta: { hintQueriesTried: string[]; perStepCounts: Record<string, number> } | null =
            null;

          if (exCatLower === "cafe") {
            browseMode = "cafe";
            const cafePick = (arr: HomeCard[]) =>
              arr.filter((c) => (isCafeLike(c) || isDessertLike(c)) && !isRestaurantLike(c));
            let raw = cafePick(fetchedPreGate);
            let note = "";
            if (raw.length === 0) {
              const allRows = await fetchHomeRecommendCandidates("all");
              allFetchLastCount = allRows.length;
              raw = cafePick(mergeHomeCardsUniqueById(fetchedPreGate, allRows));
              note = "enriched:all";
            }
            browseSorted = sortCardsForCafeBrowse(raw);
            if (note) browseSourceNote = note;
          } else if (exCatLower === "beauty") {
            browseMode = "beauty";
            let raw = fetchedPreGate.filter((c) => isBeautyLike(c));
            let note = "";
            if (raw.length === 0) {
              const [salonRows, allRows] = await Promise.all([
                fetchHomeCardsByTab("salon", { count: RECOMMEND_POOL_SINGLE_TAB }),
                fetchHomeRecommendCandidates("all"),
              ]);
              allFetchLastCount = allRows.length;
              raw = mergeHomeCardsUniqueById(salonRows, allRows).filter((c) => isBeautyLike(c));
              note = "enriched:salon+all";
            }
            browseSorted = sortCardsForBeautyBrowse(raw, explicitIntentLower === "beauty_hair");
            if (note) browseSourceNote = note;
          } else if (exCatLower === "culture") {
            browseMode = "culture";
            const hintPack = await fetchCultureStoresByNameHintsChained({
              queryLabel: options.searchQuery ?? null,
            });
            const hintCards = hintPack.cards;
            cultureHintCardsForRescue = hintCards;
            cultureHintMeta = {
              hintQueriesTried: hintPack.hintQueriesTried,
              perStepCounts: hintPack.perStepCounts,
            };

            if (cultureMuseumQuery) {
              cultureMuseumDiag = {
                hintCount: hintCards.length,
                anchorCount: hintCards.filter((c) => hasCultureAnchor(c) && !cultureRescueSoftBlock(c)).length,
              };
            }

            const fromPre = cultureBrowseFilter(fetchedPreGate);
            const actRows = await fetchHomeCardsByTab("activity", { count: RECOMMEND_POOL_SINGLE_TAB });
            const fromAct = cultureBrowseFilter(actRows);
            const allRowsCulture = await fetchHomeRecommendCandidates("all");
            const fromAll = cultureBrowseFilter(allRowsCulture);
            let pool = mergeHomeCardsUniqueById(
              mergeHomeCardsUniqueById(mergeHomeCardsUniqueById(fromPre, fromAct), fromAll),
              hintCards
            );
            browseSourceNote = "pregate+activity+all+name_hints_chained";
            browseSorted = sortCardsForCultureBrowse(cultureBrowseFilter(pool));

            if (browseSorted.length === 0) {
              const anchorOnly = hintCards.filter((c) => hasCultureAnchor(c) && !cultureRescueSoftBlock(c));
              if (anchorOnly.length > 0) {
                browseSorted = sortCardsForCultureBrowse(anchorOnly);
                browseSourceNote = `${browseSourceNote}|anchor_rescue_no_full_filter`;
                console.log("[culture final rescue]", {
                  query: options.searchQuery ?? null,
                  explicitCategory: options.explicitCategory ?? null,
                  hintQueriesTried: hintPack.hintQueriesTried,
                  hintFetchCount: hintCards.length,
                  nameHintCulturePoolCount: anchorOnly.length,
                  selectedNames: browseSorted.slice(0, RECOMMEND_DECK_SIZE).map((c) => c.name),
                  reason: "culture_browse_pool_empty_anchor_ok",
                });
              }
            }

            cultureRecoveryCounts = {
              fromPre: fromPre.length,
              fromAct: fromAct.length,
              fromAll: fromAll.length,
            };
          }

          if (exCatLower === "culture" && browseMode === "culture" && browseSorted.length === 0 && cultureHintCardsForRescue.length > 0) {
            const rescuePool = cultureHintCardsForRescue.filter(
              (c) => hasCultureAnchor(c) && !cultureRescueSoftBlock(c)
            );
            if (rescuePool.length > 0) {
              browseSorted = sortCardsForCultureBrowse(rescuePool);
              browseSourceNote = `${browseSourceNote || "hint"}|final_anchor_rescue`;
              picked = buildCategoryBrowseScoredDeck(browseSorted);
              console.log("[culture final rescue]", {
                query: options.searchQuery ?? null,
                explicitCategory: options.explicitCategory ?? null,
                hintQueriesTried: cultureHintMeta?.hintQueriesTried ?? [],
                hintFetchCount: cultureHintCardsForRescue.length,
                nameHintCulturePoolCount: rescuePool.length,
                selectedNames: picked.map((x) => x.card.name),
                reason: "culture_final_deck_empty",
              });
            }
          }

          if (browseMode && browseSorted.length > 0) {
            const deckInput =
              browseMode === "culture" && isCultureLibraryMuseumDiversityQuery(options.searchQuery)
                ? cultureLibraryMuseumDiverseShuffle(
                    browseSorted,
                    `${options.searchQuery ?? ""}|browse`,
                    String(options.searchQuery ?? "")
                  )
                : browseSorted;
            picked = buildCategoryBrowseScoredDeck(deckInput);
            if (exCatLower === "culture" && cultureRecoveryCounts) {
              console.log("[culture recovery deep audit]", {
                query: options.searchQuery ?? null,
                explicitCategory: options.explicitCategory ?? null,
                fetchedCount: fetchedPreGate.length,
                countsByTab,
                fetchTabsTried,
                hintQueriesTried: cultureHintMeta?.hintQueriesTried ?? null,
                hintPerStepCounts: cultureHintMeta?.perStepCounts ?? null,
                fetchedCultureCandidates: cultureRecoveryCounts.fromPre,
                activityCultureCandidates: cultureRecoveryCounts.fromAct,
                allCultureCandidates: cultureRecoveryCounts.fromAll,
                browsePoolCount: browseSorted.length,
                browsePoolSamples: browseSorted.slice(0, 10).map((c) => ({
                  name: c.name,
                  category: c.category,
                })),
                selectedNames: picked.map((x) => x.card.name),
                browseSourceNote: browseSourceNote || "fetchedPreGate",
              });
            }
            console.log("[category browse deck fallback]", {
              query: options.searchQuery ?? null,
              explicitCategory: options.explicitCategory ?? null,
              explicitIntent: options.explicitIntent ?? null,
              reason: "empty_final_deck",
              browseMode,
              browseSourceNote: browseSourceNote || "fetchedPreGate",
              browsePoolCount: browseSorted.length,
              browsePoolSamples: browseSorted.slice(0, 10).map((c) => ({
                name: c.name,
                category: c.category,
              })),
              selectedNames: picked.map((x) => x.card.name),
            });
          }
        }

        const isGenericFoodBrowsePath =
          isGenericFoodCategorySearchQuery(options.searchQuery) &&
          explicitIntentLower === "food_general" &&
          exCatLower === "restaurant";

        if (isGenericFoodBrowsePath) {
          let m = mergeHomeCardsUniqueById([], fetchedPreGate);
          if (m.filter(isGenericFoodBrowsePoolRow).length < 12) {
            const allRows = await fetchHomeRecommendCandidates("all");
            allFetchLastCount = allRows.length;
            m = mergeHomeCardsUniqueById(m, allRows);
          }
          genericFoodMergedPool = m;

          const pickedBeforeBrowseRecovery = picked.slice(0, 3).map((x) => x.card.name);
          const needBrowseRecovery = picked.length === 0 || genericFoodTop3AllFastFood(picked);
          if (needBrowseRecovery) {
            const ordered = composeGenericFoodOrderedCards(m, String(options.searchQuery ?? "food"));
            if (ordered.length > 0) {
              picked = buildCategoryBrowseScoredDeck(ordered);
              console.log("[generic food homecards browse recovery]", {
                searchQuery: options.searchQuery,
                browsePoolInCategory: m.filter(isGenericFoodBrowsePoolRow).length,
                orderedCount: ordered.length,
                finalDeckCount: picked.length,
                finalTop3: picked.slice(0, 3).map((x) => x.card.name),
                pickedBeforeBrowseRecovery,
              });
            } else if (genericFoodTop3AllFastFood(picked)) {
              picked = [];
            }
          }

          const searchQuery = options.searchQuery ?? null;
          const pickedBeforeGuard = picked.slice(0, 3).map((x) => x.card.name);
          const t3 = picked.slice(0, Math.min(3, picked.length));
          if (t3.length > 0 && t3.every((x) => detectFastFoodBrand(x.card))) {
            const pool = genericFoodMergedPool;
            const rescue =
              pool?.filter((c) => isGenericFoodBrowsePoolRow(c) && !detectFastFoodBrand(c)) ?? [];
            if (rescue.length > 0) {
              picked = buildCategoryBrowseScoredDeck(
                sortGenericFoodBrowseStable(rescue, `${searchQuery ?? ""}|guard`)
              );
            } else {
              picked = [];
            }
          }
          const pickedAfterGuard = picked.slice(0, 3).map((x) => x.card.name);
          const pool = genericFoodMergedPool ?? mergeHomeCardsUniqueById([], fetchedPreGate);
          const browseRows = pool.filter(isGenericFoodBrowsePoolRow);
          console.log("[generic food final debug]", {
            query: searchQuery,
            explicitIntent: options.explicitIntent ?? null,
            explicitCategory: options.explicitCategory ?? null,
            fetchedPreGateCount: fetchedPreGate.length,
            allFoodCandidateCount: browseRows.length,
            restaurantLikeCount: pool.filter(isRestaurantLike).length,
            nonFastFoodRestaurantCount: pool.filter((c) => isRestaurantLike(c) && !detectFastFoodBrand(c)).length,
            fastFoodCount: pool.filter((c) => detectFastFoodBrand(c)).length,
            pickedBeforeGuard,
            pickedAfterGuard,
            finalTop3: picked.slice(0, 3).map((x) => x.card.name),
          });
        }

        if (exCatLower === "culture" && cultureMuseumQuery && picked.length === 0) {
          const hintPack = await fetchCultureStoresByNameHintsChained({ queryLabel: "박물관" });
          const apiExtra = await fetchMuseumCardsViaSearchByNameApi("박물관");
          const mergedHints = mergeHomeCardsUniqueById(hintPack.cards, apiExtra);
          const anchorCards = mergedHints.filter((c) => hasCultureAnchor(c) && !cultureRescueSoftBlock(c));
          cultureMuseumDiag = {
            hintCount: mergedHints.length,
            anchorCount: anchorCards.length,
          };
          if (anchorCards.length > 0) {
            picked = buildCategoryBrowseScoredDeck(
              cultureLibraryMuseumDiverseShuffle(
                anchorCards,
                `${options.searchQuery ?? ""}|ultimate`,
                String(options.searchQuery ?? "")
              )
            );
          }
        }

        if (exCatLower === "culture" && cultureMuseumQuery) {
          console.log("[culture button direct museum mode]", {
            query: options.searchQuery ?? null,
            explicitCategory: options.explicitCategory ?? null,
            explicitIntent: options.explicitIntent ?? null,
            useDirectMuseumMode: true,
            hintCount: cultureMuseumDiag?.hintCount ?? countsByTab.culture_search_by_name_api ?? 0,
            anchorCount:
              cultureMuseumDiag?.anchorCount ??
              fetchedPreGate.filter((c) => hasCultureAnchor(c) && !cultureRescueSoftBlock(c)).length,
            selectedNames: picked.map((x) => x.card.name),
          });
        }

        const suppressionScope = inferStoreSuppressionScope({
          query: options.searchQuery ?? null,
          explicitCategory: options.explicitCategory ?? null,
          explicitIntent: options.explicitIntent ?? null,
        });
        const suppressionRules = await fetchActiveStoreSuppressionRules(suppressionScope);
        const suppressionBeforeTop10 = picked.slice(0, 10).map((x) => x.card.name);
        const beforeSuppressionCount = picked.length;
        const suppressionApplied = applyStoreSuppression(picked, suppressionRules, {
          scope: suppressionScope,
          getStoreId: (item) => {
            const cardAny = item.card as { place_id?: string | null; store_id?: string | null };
            return String(cardAny.place_id ?? cardAny.store_id ?? item.card.id ?? "");
          },
          getStoreName: (item) => String(item.card.name ?? ""),
        });
        picked = suppressionApplied.next;
        const suppressionAfterTop10 = picked.slice(0, 10).map((x) => x.card.name);
        console.log("[store suppression applied]", {
          scope: suppressionScope,
          ruleCount: suppressionRules.length,
          suppressedNames: suppressionApplied.suppressedNames,
          beforeTop10: suppressionBeforeTop10,
          afterTop10: suppressionAfterTop10,
        });
        if (isRestaurantDiagTargetQuery(options.searchQuery ?? null)) {
          console.log("[restaurant final pool diagnosis]", {
            query: options.searchQuery ?? null,
            beforeGateCount: fetchedPreGate.length,
            afterGateCount: afterExplicitGateCount,
            afterSafetyCount: beforeSuppressionCount,
            afterRecentExposureCount: beforeSuppressionCount,
            afterSuppressionCount: picked.length,
            finalCandidatePoolCount: rankedPrimary.length,
            finalTop20: picked.slice(0, 20).map((x) => x.card.name),
            finalTop3: picked.slice(0, 3).map((x) => x.card.name),
          });
        }

        if (foodPoolExplore) {
          const mergedFoodPoolCount = fetchedPreGate.filter(
            (c) => (isFoodLike(c) || isRestaurantLike(c)) && !isCafeLike(c) && !isBeautyLike(c)
          ).length;
          console.log("[food pool diversity audit]", {
            query: options.searchQuery ?? null,
            explicitCategory: options.explicitCategory ?? null,
            explicitIntent: options.explicitIntent ?? null,
            restaurantFetchCount: restaurantTabOnlyCount,
            allFoodLikeCount: allFetchLastCount,
            mergedFoodPoolCount,
            beforeShuffle: foodDiversityMeta?.beforeShuffle ?? null,
            afterShuffle: foodDiversityMeta?.afterShuffle ?? null,
            selectedNames: picked.map((x) => x.card.name),
          });
        }

        console.log("[category fetch diagnosis]", {
          query: options.searchQuery ?? null,
          explicitCategory: options.explicitCategory ?? null,
          explicitIntent: options.explicitIntent ?? null,
          tabsTried: fetchTabsTried,
          countsByTab,
          allCount: allFetchLastCount,
          matcherCounts: {
            afterMatcherCount,
            cafeLike: fetchedPreGate.filter((c) => isCafeLike(c)).length,
            dessertLike: fetchedPreGate.filter((c) => isDessertLike(c)).length,
            beautyLike: fetchedPreGate.filter((c) => isBeautyLike(c)).length,
            cultureLike: fetchedPreGate.filter((c) => isCultureLike(c)).length,
            fitnessLike: fetchedPreGate.filter((c) => isFitnessLike(c)).length,
            lifeLike: fetchedPreGate.filter((c) => isLifeLike(c)).length,
          },
          finalDeckCount: picked.length,
          finalTop3: picked.map((x) => x.card.name),
        });

        console.log("[recommend category button recovery]", {
          query: options.searchQuery ?? null,
          explicitIntent: options.explicitIntent ?? null,
          explicitCategory: options.explicitCategory ?? null,
          fetchTabsTried,
          fetchedCount: fetchedPreGate.length,
          recoveredFromTab,
          finalTop3: picked.map((x) => x.card.name),
        });

        console.log("[recommend category empty reason]", {
          query: options.searchQuery ?? null,
          explicitCategory: options.explicitCategory ?? null,
          fetchedCount: fetchedPreGate.length,
          afterMatcherCount,
          afterGateCount: afterExplicitGateCount,
          finalDeckCount: picked.length,
          sampleFetchedNames: fetchedPreGate.slice(0, 10).map((c) => c.name),
          sampleRejectedNames,
        });

        const matcherSample = fetched.slice(0, 14);
        console.log("[recommend category matcher audit]", {
          explicitCategory: options.explicitCategory ?? null,
          sampleNames: matcherSample.map((c) => c.name),
          cafeLikeCount: fetched.filter((c) => isCafeLike(c)).length,
          beautyLikeCount: fetched.filter((c) => isBeautyLike(c)).length,
          cultureLikeCount: fetched.filter((c) => isCultureLike(c)).length,
          fitnessLikeCount: fetched.filter((c) => isFitnessLike(c)).length,
          lifeLikeCount: fetched.filter((c) => isLifeLike(c)).length,
        });

        console.log("[recommend category recovery audit]", {
          query: options.searchQuery ?? null,
          explicitCategory: options.explicitCategory ?? null,
          explicitIntent: options.explicitIntent ?? null,
          fetchedRawCount: fetchedPreGate.length,
          fetchedCount: fetched.length,
          rankedPoolCount: rankedPrimary.length,
          afterExplicitGateCount,
          finalDeckCount: picked.length,
          finalTop3: picked.map((x) => x.card.name),
        });

        if (foodDiversityMeta) {
          console.log("[recommend food diversity]", {
            query: options.searchQuery ?? null,
            poolSize: foodDiversityMeta.poolSize,
            beforeShuffle: foodDiversityMeta.beforeShuffle,
            afterShuffle: foodDiversityMeta.afterShuffle,
            selectedNames: picked.map((x) => x.card.name),
          });
        }

        console.log("[recommend candidate pipeline]", {
          query: options.searchQuery ?? null,
          fetchedCount: fetched.length,
          rankedPoolCount: rankedPrimary.length,
          safePoolCount: [...rankedPrimary, ...rankedFallbackBoosted]
            .filter((item, idx, arr) => arr.findIndex((x) => x.card.id === item.card.id) === idx)
            .filter((item) => {
              const kidsFamily = isKidsFamilyIntent(options.searchQuery ?? null, options.scenarioObject ?? null);
              if (!kidsFamily) return true;
              return !isUnsafeForKids(item.card);
            }).length,
          gatedPoolCount: [...rankedPrimary, ...rankedFallbackBoosted]
            .filter((item, idx, arr) => arr.findIndex((x) => x.card.id === item.card.id) === idx)
            .filter((item) => {
              const detectedIntent = detectIntentFit(options.searchQuery ?? null, options.scenarioObject ?? null);
              if (detectedIntent === "family_dining") {
                return !isBeautyLike(item.card) && !isCafeLike(item.card) && !isActivityLike(item.card) && !isDessertLike(item.card);
              }
              if (detectedIntent === "kids_meal") {
                return !isBeautyLike(item.card) && !isActivityLike(item.card);
              }
              if (detectedIntent === "kids_outing") {
                return !isBeautyLike(item.card);
              }
              return true;
            }).length,
          finalDeckCount: picked.length,
          finalTop3: picked.map((x) => x.card.name),
        });

        const runNamedFoodPresetEmergencyDeck = async (tag: string): Promise<ScoredRecommendItem[]> => {
          if (cancelled || !namedFoodPresetOpt) return [];
          hamaDevLog("[HAMA_EMERGENCY_TRIGGERED]", {
            query: options.searchQuery ?? null,
            tag,
            mode: "food_preset_restaurant_only",
          });
          let cards = await fetchRestaurantOnlyFoodPresetCards({
            preset: namedFoodPresetOpt,
            phase: "broad",
            count: 520,
          });
          if (namedFoodPresetOpt.id === "tonkatsu" && cards.length < 16) {
            const relaxCards = await fetchRestaurantOnlyFoodPresetCards({
              preset: namedFoodPresetOpt,
              phase: "tonkatsu_relax",
              count: 520,
            });
            cards = mergeHomeCardsUniqueById(cards, relaxCards);
          }
          cards = filterHomeCardsForScenarioSafety(
            cards,
            options.searchQuery ?? null,
            options.scenarioObject ?? null
          );
          cards = cards.filter(
            (c) =>
              passesNamedFoodPresetFullCardGate(c, namedFoodPresetOpt, "broad") ||
              (namedFoodPresetOpt.id === "tonkatsu" && passesTonkatsuJapaneseRelaxGate(c))
          );
          if (cards.length === 0) return [];
          const recentOrderedEmergency = readRecentExposedStoreIds();
          const exposureSet = new Set(recentOrderedEmergency);
          const nonRecentForced = cards.filter((c) => {
            const id = getCardExposureId(c);
            return Boolean(id) && !exposureSet.has(id);
          });
          let pool =
            nonRecentForced.length >= Math.min(6, Math.max(cards.length - 1, 1)) ?
              nonRecentForced
            : cards;
          const queryShuffleSeed = `${options.searchQuery ?? ""}|preset_emergency|${tag}|${getOrCreateHamaSearchSeed()}`;
          pool = shuffleCardsBySeed(pool, queryShuffleSeed);
          const deckCapEmergency = deckCapDiag ?? RECOMMEND_DECK_SIZE;
          const scoredEmergency = pool.map((card, i) =>
            homeCardToBrowseScoredItem(
              card,
              640 -
                recentExposureSortPenalty(getCardExposureId(card), recentOrderedEmergency) -
                (i % 11)
            )
          );
          hamaDevLog("[HAMA_EMERGENCY_RESULT]", { tag, mode: "food_preset", count: scoredEmergency.length });
          return scoredEmergency.slice(0, deckCapEmergency);
        };

        const runEmergencyFallbackDeck = async (tag: string): Promise<ScoredRecommendItem[]> => {
          if (cancelled) return [];
          hamaDevLog("[HAMA_EMERGENCY_TRIGGERED]", { query: options.searchQuery ?? null, tag });
          const emergencyCategories = getResultsEmergencyFallbackCategories(options.searchQuery ?? null);
          const fallbackCategories = emergencyCategories ?? ["cafe", "activity", "library", "restaurant"];
          if (fallbackCategories.length === 0) return [];

          const queryShuffleSeed = `${options.searchQuery ?? ""}|emergency|${tag}|${getOrCreateHamaSearchSeed()}|a${searchAttempt}|t${String(Date.now() % 1000000)}`;
          const finalForced = await fetchEmergencySimpleCardsByCategories(fallbackCategories, {
            count: 100,
            query: options.searchQuery ?? null,
            rngSeed: queryShuffleSeed,
            scenarioStripBeautySalon: scenarioBeautyBlockActive,
          });
          exposureLogState.candidateCountBefore = finalForced.length;
          const kidsFamilyQuery = /아이|가족|키즈/.test(normalizeBrandQuery(String(options.searchQuery ?? "")));
          const safeForced =
            scenarioBeautyBlockActive
              ? finalForced.filter((card) => !homeCardMatchesScenarioBeautySalonBlock(card))
              : finalForced;
          const safetyFiltered =
            kidsFamilyQuery ? safeForced.filter((card) => !isUnsafeForKids(card)) : safeForced;
          const recentOrderedEmergency = readRecentExposedStoreIds();
          const exposureSet = new Set(recentOrderedEmergency);
          const nonRecentForced = safetyFiltered.filter((c) => {
            const id = getCardExposureId(c);
            return Boolean(id) && !exposureSet.has(id);
          });
          let pool = safetyFiltered;
          if (nonRecentForced.length >= 8) {
            pool = nonRecentForced;
            exposureLogState.excludedByRecentCount = safetyFiltered.length - pool.length;
          }
          exposureLogState.candidateCountAfter = pool.length;

          pool = shuffleCardsBySeed(pool, `${queryShuffleSeed}|poststrip`);
          const scoredEmergency = pool.map((card, i) =>
            homeCardToBrowseScoredItem(
              card,
              640 -
                recentExposureSortPenalty(getCardExposureId(card), recentOrderedEmergency) -
                (i % 11)
            )
          );
          scoredEmergency.sort((a, b) => {
            const d = b.breakdown.finalScore - a.breakdown.finalScore;
            if (Math.abs(d) > 1e-9) return d;
            const tie = hashString(`${queryShuffleSeed}|${a.card.id}|${b.card.id}`);
            return tie % 2 === 0 ? -1 : 1;
          });
          let emergencyPicked = applyBucketDiversityToPicked(
            scoredEmergency,
            options.searchQuery ?? null,
            namedFoodDeckBucketOpts ? { ...namedFoodDeckBucketOpts } : undefined
          );
          emergencyPicked = shuffleScoredItemsBySeed(
            emergencyPicked,
            `${queryShuffleSeed}|emergency_bucket_tie`
          );
          const scenarioSafetyEmerg = stripScenarioSafetyFromScoredRecommendDeck(
            emergencyPicked,
            options.searchQuery ?? null,
            options.scenarioObject ?? null
          );
          emergencyPicked = scenarioSafetyEmerg.deck;
          hamaDevLog("[HAMA_EMERGENCY_RESULT]", { tag, count: emergencyPicked.length });
          return emergencyPicked;
        };

        // 최종 handoff 직전: 음식 프리셋 긴급은 식당+키워드 전용. 보수형(고기/닭갈비)은 긴급 채움 없음.
        if (picked.length === 0) {
          const emergencyDeck =
            !namedFoodPresetOpt ? await runEmergencyFallbackDeck("initial_empty")
            : isConservativeAccuracyFirstFoodPreset(namedFoodPresetOpt) ? []
            : await runNamedFoodPresetEmergencyDeck("initial_empty");
          if (emergencyDeck.length > 0) picked = emergencyDeck;
        }

        picked = applyCultureLifestyleTop3Guard({
          selected: picked,
          candidates: cultureGuardCandidates,
          query: options.searchQuery ?? null,
        });
        picked = applyBucketDiversityToPicked(
          picked,
          options.searchQuery ?? null,
          namedFoodDeckBucketOpts ? { ...namedFoodDeckBucketOpts } : undefined
        );

        const scenarioBeautyBlockedNames: string[] = [];
        const scenarioBeautyRemovedExposureIds = new Set<string>();

        const stripScenarioBeautyDeck = (deck: ScoredRecommendItem[]): ScoredRecommendItem[] => {
          if (!scenarioBeautyBlockActive) return deck;
          return deck.filter((item) => {
            if (!homeCardMatchesScenarioBeautySalonBlock(item.card)) return true;
            const exp = getCardExposureId(item.card) || item.card.id;
            if (!scenarioBeautyRemovedExposureIds.has(exp)) {
              scenarioBeautyRemovedExposureIds.add(exp);
              scenarioBeautyBlockedNames.push(item.card.name);
            }
            return false;
          });
        };

        picked = stripScenarioBeautyDeck(picked);

        if (
          scenarioBeautyBlockActive &&
          picked.length < RECOMMEND_DECK_SIZE &&
          !cancelled &&
          !namedFoodPresetOpt
        ) {
          const refill = await runEmergencyFallbackDeck("beauty_strip_refill");
          if (refill.length > 0) {
            picked = refill;
            picked = applyCultureLifestyleTop3Guard({
              selected: picked,
              candidates: cultureGuardCandidates,
              query: options.searchQuery ?? null,
            });
            picked = applyBucketDiversityToPicked(
              picked,
              options.searchQuery ?? null,
              namedFoodDeckBucketOpts ? { ...namedFoodDeckBucketOpts } : undefined
            );
          }
        }

        picked = stripScenarioBeautyDeck(picked);

        if (scenarioBeautyBlockActive) {
          hamaDevLog("[HAMA_BLOCK_BEAUTY_FOR_SCENARIO]", {
            query: options.searchQuery ?? null,
            removedCount: scenarioBeautyBlockedNames.length,
            finalCount: picked.length,
            removedNames: scenarioBeautyBlockedNames,
          });
        }

        const scenarioSafetyActive =
          scenarioQueryNeedsKidsNightlifeSafetyStrip(
            options.searchQuery ?? null,
            options.scenarioObject ?? null
          ) || scenarioQueryNeedsRainyIndoorOutdoorStrip(options.searchQuery ?? null);

        const scenarioSafetyFinal = stripScenarioSafetyFromScoredRecommendDeck(
          picked,
          options.searchQuery ?? null,
          options.scenarioObject ?? null
        );
        picked = scenarioSafetyFinal.deck;

        if (scenarioSafetyActive) {
          hamaDevLog("[HAMA_SCENARIO_SAFETY_FILTER]", {
            query: options.searchQuery ?? null,
            removedCount: scenarioSafetyFinal.removedNames.length,
            removedNames: scenarioSafetyFinal.removedNames,
            finalCount: picked.length,
          });
        }

        hamaDevLog(
          "[HAMA_DIVERSITY_BUCKETS]",
          picked.map((item) => ({
            name: item.card.name,
            category: item.card.category,
            bucket: getDiversityBucket(item.card),
          }))
        );
        hamaDevLog("[HAMA_RESULTS] finalCards.length:", picked.length);
        hamaDevLog("[HAMA_FINAL_RETURN]", picked.length);

        hamaDevLog("[HAMA_EXPOSURE_MEMORY]", {
          recentIdsCount: readRecentExposedStoreIds().length,
          excludedByRecentCount:
            exposureLogState.excludedByRecentCount || exposureLogState.recentExposureReplacements,
          candidateCountBefore: exposureLogState.candidateCountBefore,
          candidateCountAfter: exposureLogState.candidateCountAfter,
          picked: picked.map((c) => c.card.name),
        });

        // 오베 전 중식 통합: 짜장/짬뽕 동일 덱·반복 덱 허용 — 인위적 덱 회전만 생략
        if (namedFoodPresetOpt && picked.length > 0 && namedFoodPresetOpt.id !== "chinese") {
          picked = applyNamedFoodPresetDeckRotation(picked, cultureGuardCandidates, {
            query: options.searchQuery ?? null,
            preset: namedFoodPresetOpt,
            searchAttempt,
            deckCap: deckCapDiag ?? RECOMMEND_DECK_SIZE,
            candidateCount: cultureGuardCandidates.length,
          });
        }

        if (namedFoodPresetOpt) {
          picked = guardNamedFoodPresetPickedDeck(picked, namedFoodPresetOpt, options.searchQuery ?? null);
        }

        if (namedFoodPresetOpt && picked.length > 0) {
          writeNamedFoodPrevTop3Fingerprint(
            options.searchQuery ?? null,
            namedFoodPresetOpt.id,
            top3ExposureFingerprintForDeck(picked)
          );
          commitNamedFoodTop1Streak(options.searchQuery ?? null, namedFoodPresetOpt.id, picked);
        }

        if (
          namedFoodPresetOpt &&
          isConservativeAccuracyFirstFoodPreset(namedFoodPresetOpt) &&
          picked.length < 3
        ) {
          hamaDevLog("[HAMA_FOOD_PRESET_INSUFFICIENT]", {
            query: options.searchQuery ?? null,
            presetId: namedFoodPresetOpt.id,
            threshold: 3,
            beforeClear: picked.map((p) => p.card.name),
          });
          picked = [];
        }

        const soloChineseStripPool = [...cultureGuardCandidates, ...rankedPrimary, ...rankedFallbackBoosted].filter(
          (item, idx, arr) => arr.findIndex((x) => x.card.id === item.card.id) === idx
        );
        const effectiveScenarioForSoloStrip = rankScenario ?? options.scenarioObject ?? null;
        const soloStripQuery = options.searchQuery ?? null;
        hamaDevLog("[HAMA_SOLO_TOP3_BLOCK_ENTER]", {
          tag: "callsite_before_apply",
          query: soloStripQuery,
          pickedLength: picked.length,
          isSoloSituationQuery: isSoloSituationIntentQuery(soloStripQuery, effectiveScenarioForSoloStrip),
          scenarioRawQuery: effectiveScenarioForSoloStrip?.rawQuery ?? null,
          effectiveScenarioScenario: effectiveScenarioForSoloStrip?.scenario ?? null,
          optionsSearchQuery: options.searchQuery ?? null,
          soloChineseStripPoolLength: soloChineseStripPool.length,
        });
        picked = applySoloIntentChineseTop3HardStrip(
          picked,
          soloChineseStripPool,
          soloStripQuery,
          effectiveScenarioForSoloStrip
        );

        const pickedWithReasons = applyReasonTemplateEngine({
          items: picked,
          query: options.searchQuery ?? null,
        });

        if (options.namedFoodPreset) {
          hamaDevLog("[HAMA_FOOD_PRESET]", {
            query: options.searchQuery ?? null,
            matchedFoodPreset: options.namedFoodPreset.id,
            keywords: [...options.namedFoodPreset.keywords],
            resultCount: pickedWithReasons.length,
          });
        }

        saveRecentExposedStoreIds(pickedWithReasons.map((p) => getCardExposureId(p.card)).filter(Boolean));

        if (!cancelled) {
          if (
            isGenericFoodCategorySearchQuery(options.searchQuery) &&
            explicitIntentLower === "food_general" &&
            exCatLower === "restaurant"
          ) {
            const fetchTabLabel = strictTab ?? explicitTab ?? tab;
            console.log("[generic food homecards pipeline]", {
              searchQuery: options.searchQuery ?? null,
              explicitIntent: options.explicitIntent ?? null,
              explicitCategory: options.explicitCategory ?? null,
              fetchTab: fetchTabLabel,
              fetchedCount: fetchedPreGate.length,
              rankedPoolCount: rankedPrimary.length,
              finalDeckCount: pickedWithReasons.length,
              finalTop3: pickedWithReasons.slice(0, 3).map((x) => x.card.name),
            });
          }
          if (exCatLower === "culture") {
            console.log("[culture final handoff check]", {
              query: options.searchQuery ?? null,
              finalDeckCount: pickedWithReasons.length,
              finalTop3: pickedWithReasons.slice(0, 3).map((x) => x.card.name),
              cardsPassedToResults: pickedWithReasons.slice(0, 3).map((x) => x.card.name),
            });
          }
          setPool(fetched);
          setCoursePool(wantCourse ? courseFetched : []);
          setDeckRotationKey(
            options.namedFoodPreset
              ? `${options.namedFoodPreset.id}|${searchAttempt}|${getRecentExposureRotationSignature()}`
              : ""
          );
          setCards(
            pickedWithReasons.map((p) => ({
              ...p.card,
              recommendationScoreBreakdown: {
                final: p.breakdown.finalScore,
                distance: p.breakdown.distanceScore,
                rating: p.breakdown.qualityScore,
                scenario: p.breakdown.scenarioRichScore,
                convenience: p.breakdown.convenienceScore,
                behavior: p.breakdown.behaviorBoostPillar * p.breakdown.behaviorVisibility,
                personal: p.breakdown.personalizationScore,
                activeScenario: String(p.breakdown.activeScenario),
              },
            }))
          );
          setDeckIncomplete(
            !wantCourse &&
              (options.namedFoodPreset
                ? pickedWithReasons.length < 3
                : pickedWithReasons.length > 0 && pickedWithReasons.length < RECOMMEND_DECK_SIZE)
          );
        }
      } catch (e) {
        console.error("[useHomeCards]", e);
        if (!cancelled) {
          setCards([]);
          setDeckRotationKey("");
          setCoursePool([]);
          setDeckIncomplete(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    tab,
    shuffleKey,
    intent,
    options.userLat,
    options.userLng,
    options.searchQuery,
    excludeKey,
    scenarioKey,
    userProfile,
    effectiveUserProfile,
    profileOverrideKey,
    relaxPersonalRules,
    deferRanking,
    skipFetch,
    explicitKey,
  ]);

  return { cards, deckRotationKey, candidatePool: pool, courseCandidatePool: coursePool, isLoading, deckIncomplete };
}
