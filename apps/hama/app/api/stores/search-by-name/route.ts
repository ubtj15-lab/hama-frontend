import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeBrandQuery } from "@/lib/results/placeNameSearchIntent";
import {
  fetchPlacesByCompactHalves,
  fetchPlacesByNamePatterns,
  fetchPlacesByNamePrefix,
  fetchStoresByCompactHalves,
  fetchStoresByNamePatterns,
  fetchStoresByNamePrefix,
  mergeStoreRows,
  PLACES_TABLE,
  STORES_TABLE,
} from "@/lib/places/placeNameSearch";
import { orderRowsServiceRegionFirst } from "@/lib/serviceRegion";
import type { StoreRow } from "@/lib/storeTypes";
import { isAlcoholNightlifeHaystack } from "@/lib/recommend/childFriendlyScore";
import {
  applyStoreSuppression,
  fetchActiveStoreSuppressionRules,
  inferStoreSuppressionScope,
} from "@/lib/recommend/storeSuppression";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeToken(s: string): string {
  return s.replace(/[%_]/g, "").trim().slice(0, 40);
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function normCompactName(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

/** 짧은 문화 토큰만 다양성·약한 셔플 적용 (쿼리 문자열 그대로, normalize 후 safe) */
const CULTURE_DIVERSITY_QUERIES = new Set([
  "박물관",
  "미술관",
  "전시관",
  "도서관",
  "과학관",
  "기념관",
]);

const RECENT_EXPOSURE_CULTURE_QUERIES = new Set([
  "박물관",
  "미술관",
  "전시관",
  "과학관",
  "기념관",
]);

/** 카페·푸드 단일 토큰 — 상위 풀 안 약한 셔플만 (추천 품질 유지) */
const FOOD_CAFE_DIVERSITY_SINGLE = new Set([
  "카페",
  "커피",
  "디저트",
  "베이커리",
  "브런치",
  "라떼",
  "아메리카노",
  "식당",
  "맛집",
  "음식점",
  "한식",
  "중식",
  "일식",
  "양식",
  "분식",
  "치킨",
  "피자",
  "고기",
  "밥집",
  "푸드",
  "점심",
  "저녁",
  "외식",
  "밥",
]);

/** 패스트푸드 체인 억제 — 식당/맛집/푸드 등 (문화·카페·도서관 경로와 무관) */
const FOOD_FASTFOOD_GUARD_EXACT = new Set([
  "푸드",
  "식당",
  "맛집",
  "밥",
  "한식",
  "점심",
  "저녁",
  "외식",
]);

const FAST_FOOD_NAME_MARKERS = [
  "kfc",
  "맥도날드",
  "맥도날도",
  "mcdonald",
  "롯데리아",
  "lotteria",
  "버거킹",
  "burger king",
  "맘스터치",
  "mom's touch",
  "mom's",
  "써브웨이",
  "서브웨이",
  "subway",
  "피자헛",
  "pizza hut",
  "도미노",
  "domino",
  "미스터피자",
  "mr. pizza",
  "mr pizza",
] as const;

function isFoodFastfoodGuardQuery(safe: string): boolean {
  const t = safe.trim();
  if (!t) return false;
  if (FOOD_FASTFOOD_GUARD_EXACT.has(t)) return true;
  if (t.includes("외식")) return true;
  if (t.includes("아이랑") && t.includes("밥")) return true;
  return false;
}

function isFastFoodChainRow(row: StoreRow): boolean {
  const n = String(row.name ?? "").toLowerCase();
  return FAST_FOOD_NAME_MARKERS.some((m) => n.includes(m));
}

function alcoholVenueRowBlob(row: StoreRow): string {
  return normSearchText(
    [String(row.name ?? ""), ...(row.tags ?? []), ...(row.mood ?? []), ...(row.menu_keywords ?? [])].join(" ")
  );
}

function isAlcoholNightlifeStoreRow(row: StoreRow): boolean {
  return isAlcoholNightlifeHaystack(alcoholVenueRowBlob(row));
}

/**
 * 식당·맛집·푸드 계열: 일반 식당 후보가 3곳 이상이면 술집·이자카야 후순위.
 */
function applyFoodAlcoholVenueGuard(items: StoreRow[], searchQuery: string, safe: string): StoreRow[] {
  if (!isFoodFastfoodGuardQuery(safe) || items.length === 0) return items;
  const non: StoreRow[] = [];
  const alc: StoreRow[] = [];
  for (const r of items) {
    if (isAlcoholNightlifeStoreRow(r)) alc.push(r);
    else non.push(r);
  }
  if (non.length < 3) return items;
  return [...non, ...alc].slice(0, Math.max(items.length, 14));
}

const FOOD_DINING_STRICT_FALLBACK_SAFE = new Set(["푸드", "식당"]);

const FOOD_DINING_FALLBACK_NAME_PATTERNS = [
  "한식",
  "중식",
  "일식",
  "분식",
  "김밥",
  "식당",
  "음식점",
  "국밥",
  "돈까스",
  "치킨",
  "고기",
  "갈비",
  "국수",
  "칼국수",
  "닭갈비",
  "파스타",
  "회",
  "백반",
  "샤브",
] as const;

const FOOD_DINING_FALLBACK_SIGNAL = new RegExp(
  [
    "식당",
    "음식점",
    "한식",
    "중식",
    "일식",
    "분식",
    "국수",
    "칼국수",
    "김밥",
    "고기",
    "갈비",
    "샤브",
    "돈까스",
    "회",
    "백반",
    "국밥",
    "파스타",
    "닭갈비",
  ].join("|")
);

function foodDiningFallbackRowBlob(row: StoreRow): string {
  const parts: string[] = [
    String(row.name ?? ""),
    ...(row.tags ?? []),
    ...(row.mood ?? []),
    ...(row.menu_keywords ?? []),
  ];
  return normSearchText(parts.join(" "));
}

function isFoodDiningFallbackExcludedRow(row: StoreRow): boolean {
  const c = String(row.category ?? "").toLowerCase();
  if (
    ["cafe", "coffee", "ce7", "salon", "museum", "library", "beauty", "gym", "fitness", "life"].includes(c)
  ) {
    return true;
  }
  const blob = foodDiningFallbackRowBlob(row);
  if (
    /카페|커피|베이커리|디저트|빵집|케이크|도넛|미용|헤어|네일|박물관|도서관|미술관|갤러리|gallery|문화원|뮤지엄|헬스|헬스장|pt\b|필라테스|요가|스타벅스|투썸|이디야/.test(
      blob
    )
  ) {
    return true;
  }
  return false;
}

/** 푸드/식당 빈 결과 전용: 식당형 + 키워드 신호, 카페·문화·뷰티 제외 */
function isRestaurantLikeFoodFallbackRow(row: StoreRow): boolean {
  if (isFoodDiningFallbackExcludedRow(row)) return false;
  const blob = foodDiningFallbackRowBlob(row);
  if (!FOOD_DINING_FALLBACK_SIGNAL.test(blob)) return false;
  const c = String(row.category ?? "").toLowerCase();
  if (["restaurant", "food", "fd6", "meal"].includes(c)) return true;
  if (!c) return true;
  return false;
}

/**
 * 푸드/식당 계열: 일반 식당이 3곳 이상이면 top3에서 패스트푸드 체인 제외.
 * diversity shuffle 이후 호출 — KFC 등이 섞여 올라온 순서를 바로잡음.
 * 비패스트푸드가 하나도 없으면 순서 변경 없이 원본 반환(결과 전체 비우기 방지).
 */
function applyFoodFastfoodGuard(items: StoreRow[], searchQuery: string, safe: string): StoreRow[] {
  if (!isFoodFastfoodGuardQuery(safe) || items.length === 0) return items;

  const beforeTop10 = items.slice(0, 10).map((r) => r.name);
  const nonFf: StoreRow[] = [];
  const ff: StoreRow[] = [];
  for (const r of items) {
    if (isFastFoodChainRow(r)) ff.push(r);
    else nonFf.push(r);
  }
  const nonFastFoodCount = nonFf.length;

  if (nonFastFoodCount === 0) {
    // eslint-disable-next-line no-console
    console.log("[food fastfood guard]", {
      query: searchQuery,
      beforeTop10,
      nonFastFoodCount,
      fastFoodNames: ff.slice(0, 10).map((r) => r.name),
      selectedTop3: items.slice(0, 3).map((r) => r.name),
    });
    return items;
  }

  let out: StoreRow[] = [];
  if (nonFastFoodCount >= 3) {
    out = [...nonFf];
    for (const r of ff) {
      if (out.length >= 12) break;
      out.push(r);
    }
  } else {
    out = [...nonFf, ...ff].slice(0, 12);
  }

  if (out.length === 0) return items;

  const selectedTop3 = out.slice(0, 3).map((r) => r.name);
  if (selectedTop3.every((n) => !n) && items.length > 0) {
    return items;
  }

  // eslint-disable-next-line no-console
  console.log("[food fastfood guard]", {
    query: searchQuery,
    beforeTop10,
    nonFastFoodCount,
    fastFoodNames: ff.slice(0, 10).map((r) => r.name),
    selectedTop3,
  });

  return out;
}

function seoulDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", dateStyle: "short" }).format(new Date());
}

function searchDiversitySeed(safe: string, dayKey: string, headerSalt: string): number {
  const s = `${safe}|${dayKey}|${headerSalt}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shouldApplySearchDiversity(safe: string): boolean {
  return CULTURE_DIVERSITY_QUERIES.has(safe) || FOOD_CAFE_DIVERSITY_SINGLE.has(safe);
}

function isRestaurantOrCafeRow(row: StoreRow): boolean {
  const c = String(row.category ?? "").toLowerCase();
  return (
    c === "restaurant" ||
    c === "cafe" ||
    c === "fd6" ||
    c === "ce7" ||
    c === "meal" ||
    c === "food" ||
    c === "coffee"
  );
}

function getSearchResultStableId(row: StoreRow): string {
  const r = row as StoreRow & { place_id?: string | null; store_id?: string | null };
  return String(r.place_id ?? r.store_id ?? r.id ?? "").trim();
}

function normalizeRecentName(name: string): string {
  return String(name ?? "").toLowerCase().replace(/\s+/g, "").trim();
}

function applyRecentExposureCultureTop3Adjustment(
  items: StoreRow[],
  safe: string,
  recentIds: string[],
  recentNames: string[]
): { next: StoreRow[]; replacedNames: string[]; decision: Record<string, unknown> } {
  if (!RECENT_EXPOSURE_CULTURE_QUERIES.has(safe)) {
    return {
      next: items,
      replacedNames: [],
      decision: {
        poolSize: items.length,
        secondThirdRecent: false,
        replacementCandidates: 0,
        replacementApplied: false,
      },
    };
  }
  if (items.length < 4 || (recentIds.length === 0 && recentNames.length === 0)) {
    return {
      next: items,
      replacedNames: [],
      decision: {
        poolSize: items.length,
        secondThirdRecent: false,
        replacementCandidates: 0,
        replacementApplied: false,
      },
    };
  }
  const recentSet = new Set(recentIds);
  const recentNameSet = new Set(recentNames.map((x) => normalizeRecentName(x)).filter(Boolean));
  const isRecentRow = (row: StoreRow): boolean => {
    const sid = getSearchResultStableId(row);
    if (sid && recentSet.has(sid)) return true;
    const nm = normalizeRecentName(String(row.name ?? ""));
    return nm ? recentNameSet.has(nm) : false;
  };
  const out = [...items];
  const topWindow = Math.min(10, out.length);
  const replacedNames: string[] = [];
  const usedTopIds = new Set(out.slice(0, 3).map((r) => getSearchResultStableId(r)));
  const secondThirdRecent = [1, 2].some((i) => i < out.length && isRecentRow(out[i]!));
  const replacementCandidates = out.slice(3, topWindow).filter((r) => !isRecentRow(r)).length;
  let replacementApplied = false;
  const firstNameBefore = out[0]?.name ?? null;
  const firstWasRecent = out[0] ? isRecentRow(out[0]!) : false;
  let replacementName: string | null = null;

  if (out.length >= 5 && out[0] && firstWasRecent) {
    const pickRotationIndex = () => {
      const top5End = Math.min(5, topWindow);
      for (let j = 1; j < top5End; j += 1) {
        const cand = out[j]!;
        const sid = getSearchResultStableId(cand);
        if (!sid) continue;
        if (isRecentRow(cand)) continue;
        if (isRestaurantOrCafeRow(cand)) continue;
        return j;
      }
      for (let j = 5; j < topWindow; j += 1) {
        const cand = out[j]!;
        const sid = getSearchResultStableId(cand);
        if (!sid) continue;
        if (isRecentRow(cand)) continue;
        if (isRestaurantOrCafeRow(cand)) continue;
        return j;
      }
      return -1;
    };
    const rotIdx = pickRotationIndex();
    if (rotIdx >= 0) {
      const tmp = out[0]!;
      out[0] = out[rotIdx]!;
      out[rotIdx] = tmp;
      replacementName = out[0]?.name ?? null;
      replacementApplied = true;
      const oldFirstId = getSearchResultStableId(tmp);
      if (oldFirstId) usedTopIds.delete(oldFirstId);
      const newFirstId = getSearchResultStableId(out[0]!);
      if (newFirstId) usedTopIds.add(newFirstId);
    }
  }
  console.log("[search-name first-rank rotation]", {
    query: safe,
    firstNameBefore,
    firstWasRecent,
    replacementName,
    firstNameAfter: out[0]?.name ?? null,
    selectedTop3AfterRotation: out.slice(0, 3).map((r) => r.name),
  });

  for (let i = 1; i <= 2 && i < topWindow; i += 1) {
    const current = out[i]!;
    const currentStableId = getSearchResultStableId(current);
    if (!isRecentRow(current)) continue;
    let swapIdx = -1;
    for (let j = 3; j < topWindow; j += 1) {
      const cand = out[j]!;
      const candStableId = getSearchResultStableId(cand);
      if (!candStableId) continue;
      if (isRecentRow(cand)) continue;
      if (usedTopIds.has(candStableId)) continue;
      swapIdx = j;
      break;
    }
    if (swapIdx < 0) continue;
    const tmp = out[i]!;
    out[i] = out[swapIdx]!;
    out[swapIdx] = tmp;
    replacedNames.push(tmp.name ?? "");
    replacementApplied = true;
    usedTopIds.delete(currentStableId);
    usedTopIds.add(getSearchResultStableId(out[i]!));
  }
  return {
    next: out,
    replacedNames,
    decision: {
      poolSize: items.length,
      secondThirdRecent,
      replacementCandidates,
      replacementApplied,
    },
  };
}

/**
 * 상위 10~20개 풀 안에서만 약한 시드 셔플.
 * - culture: 1·2순 고정 위주, 3~n순 위주 다량 스왑
 * - 기타(카페·푸드 단일 토큰): 기존 약한 셔플
 */
function applySearchPoolDiversityShuffle(items: StoreRow[], seed: number, cultureMode: boolean): StoreRow[] {
  if (items.length < 4) return items;
  const pool = Math.min(20, items.length);
  const head = items.slice(0, pool);
  const tail = items.slice(pool);
  let rng = seed >>> 0;
  const next = () => {
    rng = (rng * 1103515245 + 12345) >>> 0;
    return rng;
  };
  if (pool >= 2 && (next() % (cultureMode ? 25 : 20)) === 0) {
    const a0 = head[0]!;
    head[0] = head[1]!;
    head[1] = a0;
  }
  const shuffleSlice = cultureMode ? head.slice(2) : head.slice(1);
  if (shuffleSlice.length < 2) return [...head, ...tail];
  const swapCount = cultureMode
    ? Math.min(36, Math.max(12, shuffleSlice.length * 6))
    : Math.min(5 + (next() % 6), shuffleSlice.length * 3);
  const a = [...shuffleSlice];
  for (let k = 0; k < swapCount; k += 1) {
    const i = next() % a.length;
    const j = next() % a.length;
    if (i !== j) {
      const t = a[i]!;
      a[i] = a[j]!;
      a[j] = t;
    }
  }
  if (cultureMode && head[0] && head[1]) {
    return [head[0]!, head[1]!, ...a, ...tail];
  }
  return [head[0]!, ...a, ...tail];
}

/** 이름 기준 유형 버킷 — 라운드로빈·로그용 */
function cultureNameSearchBucket(name: string): string {
  const n = String(name).toLowerCase();
  if (/미술관|아트|갤러리|gallery/.test(n)) return "art";
  if (/과학관/.test(n)) return "science";
  if (/도서관|장서/.test(n)) return "library";
  if (/전시관|전시장|exhibition/.test(n)) return "exhibition";
  if (/기념관|역사관|역사박물관/.test(n)) return "history";
  if (/박물관|뮤지엄|museum/.test(n)) return "museum";
  if (/영화|극장|공연|콘서트|뮤지컬/.test(n)) return "show";
  return "other";
}

function pickDiverseCultureNameRows(
  qualityFiltered: Array<{ row: StoreRow; score: number; tier: string }>,
  safe: string,
  limit: number
): StoreRow[] {
  if (!CULTURE_DIVERSITY_QUERIES.has(safe)) return [];
  const cap = Math.min(qualityFiltered.length, 40);
  const top = qualityFiltered.slice(0, cap);
  const byBucket = new Map<string, Array<{ row: StoreRow; score: number; tier: string }>>();
  for (const item of top) {
    const b = cultureNameSearchBucket(String(item.row.name ?? ""));
    const arr = byBucket.get(b) ?? [];
    arr.push(item);
    byBucket.set(b, arr);
  }
  const order = ["museum", "exhibition", "art", "library", "science", "history", "show", "other"];
  const out: StoreRow[] = [];
  const seen = new Set<string>();
  let round = 0;
  while (out.length < limit && round < cap) {
    let addedRound = false;
    for (const bucket of order) {
      const arr = byBucket.get(bucket);
      if (!arr?.length) continue;
      if (round < arr.length) {
        const row = arr[round]!.row;
        if (row.id && !seen.has(row.id)) {
          seen.add(row.id);
          out.push(row);
          addedRound = true;
          if (out.length >= limit) break;
        }
      }
    }
    if (!addedRound) break;
    round += 1;
  }
  if (out.length < limit) {
    for (const { row } of top) {
      if (!row.id || seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function nameMatchTierScore(
  name: string,
  queryCompact: string,
  querySpaced: string
): { base: number; tier: "exact" | "prefix" | "substring" | "multi_token" | "spaced_merge" | "sql_loose" } {
  const n = normCompactName(name);
  const q = queryCompact;
  if (!q || !n) return { base: 0, tier: "sql_loose" };
  if (n === q) return { base: 1_000_000, tier: "exact" };
  if (n.startsWith(q)) return { base: 920_000, tier: "prefix" };
  if (n.includes(q)) return { base: 720_000, tier: "substring" };
  const qs = querySpaced.replace(/\s+/g, " ").trim().toLowerCase();
  const parts = qs.split(/\s+/).filter((x) => x.length >= 1);
  if (parts.length >= 2 && parts.every((p) => n.includes(p.replace(/\s/g, "").toLowerCase()))) {
    return { base: 680_000, tier: "multi_token" };
  }
  if (qs && n.includes(qs.replace(/\s/g, ""))) return { base: 640_000, tier: "spaced_merge" };
  return { base: 200_000, tier: "sql_loose" };
}

function buildNamePatterns(safe: string): string[] {
  const compact = safe.replace(/\s+/g, "");
  const patterns = new Set<string>();
  patterns.add(safe);
  if (compact !== safe && compact.length >= 1) patterns.add(compact);
  for (const tok of safe.split(/\s+/)) {
    const t = tok.trim();
    if (t.length >= 2) patterns.add(t);
  }
  return [...patterns];
}

function normSearchText(s: string): string {
  return String(s ?? "").toLowerCase();
}

function tagsIncludeNeedle(row: StoreRow, needle: string): boolean {
  const t = row.tags;
  if (!Array.isArray(t)) return false;
  const n = needle.toLowerCase();
  return t.some((x) => String(x).toLowerCase().includes(n));
}

/** normalize+sanitize 후 정확히 「도서관」 단일 토큰일 때만 true */
function isStrictLibraryNameQuery(safe: string): boolean {
  return safe === "도서관";
}

/**
 * 도서관 검색 전용: 이름/태그/카테고리상 박물관 성격 후보는 제외하거나 후순위.
 * (예: 국립중앙도서관 기록매체박물관 — 이름에 도서관+박물관)
 */
function isMuseumLikeForLibraryQuery(row: StoreRow): boolean {
  const name = normSearchText(row.name ?? "");
  if (name.includes("박물관")) return true;
  if (tagsIncludeNeedle(row, "박물관")) return true;
  const c = String(row.category ?? "").toLowerCase();
  if (c === "museum") return true;
  if (c === "activity" && name.includes("박물관")) return true;
  return false;
}

function isLibraryCandidateRow(row: StoreRow): boolean {
  if (isMuseumLikeForLibraryQuery(row)) return false;
  const name = normSearchText(row.name ?? "");
  const c = String(row.category ?? "").toLowerCase();
  if (c === "library") return true;
  if (tagsIncludeNeedle(row, "도서관")) return true;
  if (name.includes("도서관") && !name.includes("박물관")) return true;
  return false;
}

/**
 * safe === "도서관" 일 때 후보 풀 축소.
 * - 도서관형 후보가 3개 이상이면 library 후보만 사용(박물관형 미포함).
 * - 그 미만이면 박물관형만 제외한 뒤 점수순(보조 박물관 카테고리 확장 없음).
 */
function filterQualityForStrictLibraryQuery(
  searchQuery: string,
  safe: string,
  qualityFiltered: Array<{ row: StoreRow; score: number; tier: string }>
): Array<{ row: StoreRow; score: number; tier: string }> {
  if (!isStrictLibraryNameQuery(safe)) return qualityFiltered;

  const beforeCount = qualityFiltered.length;
  const removedMuseumLikeNames: string[] = [];
  for (const { row } of qualityFiltered) {
    if (isMuseumLikeForLibraryQuery(row)) {
      removedMuseumLikeNames.push(String(row.name ?? ""));
    }
  }

  const libraryLikeCount = qualityFiltered.filter(({ row }) => isLibraryCandidateRow(row)).length;
  const nonMuseum = qualityFiltered.filter(({ row }) => !isMuseumLikeForLibraryQuery(row));

  let pool: Array<{ row: StoreRow; score: number; tier: string }>;
  if (libraryLikeCount >= 3) {
    pool = qualityFiltered.filter(({ row }) => isLibraryCandidateRow(row));
  } else {
    pool = nonMuseum;
  }

  pool = [...pool].sort((a, b) => b.score - a.score);
  const selectedNames = pool.slice(0, 12).map(({ row }) => row.name);

  // eslint-disable-next-line no-console
  console.log("[library search filter]", {
    query: searchQuery,
    beforeCount,
    libraryLikeCount,
    removedMuseumLikeNames,
    selectedNames,
  });

  return pool;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const searchQuery = String(url.searchParams.get("q") ?? "").trim();
    const safe = sanitizeToken(normalizeBrandQuery(searchQuery));
    const explicitCategory = String(url.searchParams.get("category") ?? "").trim();
    const explicitIntent = String(url.searchParams.get("intent") ?? "").trim();

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[place-search] query:", searchQuery);
      // eslint-disable-next-line no-console
      console.log("[place-search] tables:", STORES_TABLE, "+", PLACES_TABLE);
      // eslint-disable-next-line no-console
      console.log("[place-search] normalized:", safe);
    }

    if (!safe || safe.length < 2) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    const hasLoc = Number.isFinite(lat) && Number.isFinite(lng);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ items: [], error: "missing_env" }, { status: 500 });
    }

    const wantDebug = url.searchParams.get("debug") === "1";

    const supabase = createClient(supabaseUrl, supabaseKey);

    const patterns = buildNamePatterns(safe);
    const sr = await fetchStoresByNamePatterns(supabase, patterns);
    const pr = await fetchPlacesByNamePatterns(supabase, patterns);
    const patternRows = mergeStoreRows(sr.rows, pr.rows);
    const hadError = patternRows.length === 0 && sr.hadError && pr.hadError;

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[place-search] data (pattern phase row count):", patternRows.length);
      // eslint-disable-next-line no-console
      console.log("[place-search] error (pattern phase):", hadError ? "both_tables_failed" : null);
    }

    if (hadError && patternRows.length === 0) {
      const body: Record<string, unknown> = { items: [], error: "query_failed" };
      if (wantDebug) {
        body.debug = {
          queryRaw: searchQuery,
          queryNormalized: safe,
          tables: [STORES_TABLE, PLACES_TABLE],
          conclusion: "api_error",
          patternCount: patternRows.length,
        };
      }
      return NextResponse.json(body, { status: 500 });
    }

    let rows = patternRows;
    let stage = "pattern" as "pattern" | "prefix" | "halves";

    if (rows.length === 0) {
      const compact = safe.replace(/\s+/g, "");
      const sub = sanitizeToken(compact.length >= 3 ? compact.slice(0, 3) : safe.slice(0, 2));
      if (sub.length >= 2) {
        const rs = await fetchStoresByNamePrefix(supabase, sub);
        const rp = await fetchPlacesByNamePrefix(supabase, sub);
        rows = mergeStoreRows(rs, rp);
        if (rows.length) stage = "prefix";
      }
    }

    if (rows.length === 0) {
      const hs = await fetchStoresByCompactHalves(supabase, safe);
      const hp = await fetchPlacesByCompactHalves(supabase, safe);
      rows = mergeStoreRows(hs, hp);
      if (rows.length) stage = "halves";
    }

    rows = orderRowsServiceRegionFirst(rows);
    if (CULTURE_DIVERSITY_QUERIES.has(safe)) {
      rows = rows.filter((r) => !isRestaurantOrCafeRow(r));
    }

    const rawRowsCount = rows.length;

    const queryCompact = normCompactName(safe);

    const scored = rows.map((r) => {
      const name = String(r.name ?? "");
      const { base: nameSc, tier } = nameMatchTierScore(name, queryCompact, safe);
      let distScore = 0;
      if (
        hasLoc &&
        r.lat != null &&
        r.lng != null &&
        Number.isFinite(r.lat) &&
        Number.isFinite(r.lng)
      ) {
        const km = distanceKm(lat, lng, r.lat, r.lng);
        distScore = Math.max(0, 120 - Math.min(km, 120));
      }
      return { row: r, score: nameSc + distScore, tier };
    });

    const qc = queryCompact;
    const qualityFiltered = scored.filter(({ row, tier }) => {
      const n = normCompactName(String(row.name ?? ""));
      if (tier !== "sql_loose") return true;
      if (qc.length <= 3) return true;
      return n.includes(qc);
    });

    qualityFiltered.sort((a, b) => b.score - a.score);

    const qualityFilteredCount = qualityFiltered.length;

    const pipelineFiltered = filterQualityForStrictLibraryQuery(searchQuery, safe, qualityFiltered);
    if (isStrictLibraryNameQuery(safe)) {
      const libraryLikeCount = pipelineFiltered.filter(({ row }) => isLibraryCandidateRow(row)).length;
      const removedMuseumLikeNames = qualityFiltered
        .filter(({ row }) => isMuseumLikeForLibraryQuery(row))
        .map(({ row }) => String(row.name ?? ""));
      const selectedNames = pipelineFiltered.slice(0, 12).map(({ row }) => row.name);
      console.log("[library search diagnosis]", {
        query: searchQuery,
        rawRowsCount,
        qualityFilteredCount,
        libraryLikeCount,
        removedMuseumLikeNames,
        selectedNames,
      });
    }

    const pipelineFilteredCount = pipelineFiltered.length;

    const categoryBuckets: Record<string, number> = {};
    for (const { row } of pipelineFiltered.slice(0, 80)) {
      const b = cultureNameSearchBucket(String(row.name ?? ""));
      categoryBuckets[b] = (categoryBuckets[b] ?? 0) + 1;
    }
    const topBefore = pipelineFiltered.slice(0, 3).map(({ row }) => row.name);
    if (CULTURE_DIVERSITY_QUERIES.has(safe)) {
      // eslint-disable-next-line no-console
      console.log("[museum diversity pool]", {
        query: searchQuery,
        totalCandidates: pipelineFiltered.length,
        topBefore,
        categoryBuckets,
      });
    }

    const diverse = pickDiverseCultureNameRows(pipelineFiltered, safe, 12);
    let items: StoreRow[] =
      diverse.length > 0
        ? diverse
        : (() => {
            const seen = new Set<string>();
            const acc: StoreRow[] = [];
            for (const { row } of pipelineFiltered) {
              if (!row.id || seen.has(row.id)) continue;
              seen.add(row.id);
              acc.push(row);
              if (acc.length >= 12) break;
            }
            return acc;
          })();

    const diversitySalt = String(
      req.headers.get("x-hama-search-seed") ?? req.headers.get("x-museum-diversity-seed") ?? ""
    )
      .trim()
      .slice(0, 160);
    const headerRecentIdsRaw = String(req.headers.get("x-hama-recent-exposed-ids") ?? "");
    const headerRecentNamesRaw = String(req.headers.get("x-hama-recent-exposed-names") ?? "");
    const recentIds = headerRecentIdsRaw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 10);
    const recentNames = headerRecentNamesRaw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 10);
    const seedNum = searchDiversitySeed(`${safe}|${searchQuery}`, seoulDateKey(), diversitySalt || "no-header");

    let searchDiversityBeforeTop10 = items.slice(0, 10).map((r) => r.name);
    let searchDiversityAfterTop10 = searchDiversityBeforeTop10;
    if (shouldApplySearchDiversity(safe)) {
      const beforeTop10 = items.slice(0, 10).map((r) => r.name);
      searchDiversityBeforeTop10 = beforeTop10;
      if (items.length < 4) {
        // eslint-disable-next-line no-console
        console.log("[search diversity skipped]", {
          query: searchQuery,
          reason: "pool<=3",
          poolSize: items.length,
        });
      } else {
        const poolSize = Math.min(20, items.length);
        const cultureDiversity = CULTURE_DIVERSITY_QUERIES.has(safe);
        const nextItems = applySearchPoolDiversityShuffle(items, seedNum, cultureDiversity);
        const afterTop10 = nextItems.slice(0, 10).map((r) => r.name);
        searchDiversityAfterTop10 = afterTop10;
        if (cultureDiversity) {
          // eslint-disable-next-line no-console
          console.log("[culture/library/museum diversity]", {
            query: searchQuery,
            seed: diversitySalt || String(seedNum),
            poolSize: items.length,
            beforeTop10,
            afterTop10,
            selectedTop5: nextItems.slice(0, 5).map((r) => r.name),
          });
        } else {
          // eslint-disable-next-line no-console
          console.log("[search result diversity]", {
            query: searchQuery,
            seed: diversitySalt || String(seedNum),
            poolSize,
            beforeTop10,
            afterTop10,
            selectedTop3: nextItems.slice(0, 3).map((r) => r.name),
          });
        }
        items = nextItems;
      }
    }
    const beforeRecentExposureTop10 = items.slice(0, 10).map((r) => r.name);
    console.log("[search-name recent id match check]", {
      query: searchQuery,
      recentIds,
      candidates: items.slice(0, 10).map((row) => {
        const r = row as StoreRow & { place_id?: string | null; store_id?: string | null };
        const stableId = getSearchResultStableId(row);
        return {
          name: row.name,
          id: row.id,
          place_id: r.place_id ?? null,
          store_id: r.store_id ?? null,
          stableId,
          matched: recentIds.includes(stableId),
        };
      }),
    });
    const recentExposureAdjusted = applyRecentExposureCultureTop3Adjustment(items, safe, recentIds, recentNames);
    items = recentExposureAdjusted.next;
    const afterRecentExposureTop10 = items.slice(0, 10).map((r) => r.name);
    if (RECENT_EXPOSURE_CULTURE_QUERIES.has(safe)) {
      console.log("[search-name recent replacement decision]", {
        query: searchQuery,
        ...(recentExposureAdjusted.decision ?? {}),
      });
    }
    if (RECENT_EXPOSURE_CULTURE_QUERIES.has(safe)) {
      console.log("[search-name recent exposure diversity]", {
        query: searchQuery,
        headerRecentIdsRaw,
        recentIds,
        beforeTop10: beforeRecentExposureTop10,
        afterTop10: afterRecentExposureTop10,
        replacedNames: recentExposureAdjusted.replacedNames,
        selectedTop3: items.slice(0, 3).map((r) => r.name),
      });
    }
    console.log("[search-name fixed-result diagnosis]", {
      query: searchQuery,
      rawRowsCount,
      qualityFilteredCount,
      diversityPoolCount: items.length,
      beforeTop10: searchDiversityBeforeTop10,
      afterTop10: searchDiversityAfterTop10,
      selectedTop3: items.slice(0, 3).map((r) => r.name),
      seed: diversitySalt || String(seedNum),
    });

    const beforeGuardNames = items.map((r) => r.name);
    const itemsCount = items.length;
    items = applyFoodFastfoodGuard(items, searchQuery, safe);
    items = applyFoodAlcoholVenueGuard(items, searchQuery, safe);
    const afterGuardNames = items.map((r) => r.name);

    let foodRecoveryFallbackUsed = false;
    let foodRecoveryPoolCount = 0;
    if (FOOD_DINING_STRICT_FALLBACK_SAFE.has(safe) && items.length === 0) {
      const patterns = [...FOOD_DINING_FALLBACK_NAME_PATTERNS];
      const srFb = await fetchStoresByNamePatterns(supabase, patterns);
      const prFb = await fetchPlacesByNamePatterns(supabase, patterns);
      let poolRows = mergeStoreRows(srFb.rows, prFb.rows);
      poolRows = orderRowsServiceRegionFirst(poolRows);
      const picked = poolRows.filter((r) => isRestaurantLikeFoodFallbackRow(r));
      foodRecoveryPoolCount = picked.length;
      const seenFb = new Set<string>();
      const accFb: StoreRow[] = [];
      for (const r of picked) {
        if (!r.id || seenFb.has(r.id)) continue;
        seenFb.add(r.id);
        accFb.push(r);
        if (accFb.length >= 12) break;
      }
      if (accFb.length > 0) {
        items = applyFoodFastfoodGuard(accFb, searchQuery, safe);
        foodRecoveryFallbackUsed = true;
      }
      // eslint-disable-next-line no-console
      console.log("[food search recovery fallback]", {
        query: searchQuery,
        fallbackUsed: foodRecoveryFallbackUsed,
        fallbackPoolCount: foodRecoveryPoolCount,
        selectedNames: items.map((r) => r.name),
      });
    }

    if (safe === "푸드" || safe === "식당") {
      // eslint-disable-next-line no-console
      console.log("[food search drop diagnosis]", {
        query: searchQuery,
        safe,
        rawRowsCount,
        qualityFilteredCount,
        pipelineFilteredCount,
        itemsCount,
        finalItemsCount: items.length,
        beforeGuardNames,
        afterGuardNames,
      });
    }

    const suppressionScope = inferStoreSuppressionScope({
      query: searchQuery,
      explicitCategory,
      explicitIntent,
    });
    const suppressionRules = await fetchActiveStoreSuppressionRules(suppressionScope);
    const suppressionBeforeTop10 = items.slice(0, 10).map((r) => r.name);
    const suppressionApplied = applyStoreSuppression(items, suppressionRules, {
      scope: suppressionScope,
      getStoreId: (row) => {
        const r = row as StoreRow & { place_id?: string | null; store_id?: string | null };
        return String(r.store_id ?? r.place_id ?? r.id ?? "");
      },
      getStoreName: (row) => String(row.name ?? ""),
    });
    items = suppressionApplied.next;
    const suppressionAfterTop10 = items.slice(0, 10).map((r) => r.name);
    console.log("[store suppression applied]", {
      scope: suppressionScope,
      ruleCount: suppressionRules.length,
      suppressedNames: suppressionApplied.suppressedNames,
      beforeTop10: suppressionBeforeTop10,
      afterTop10: suppressionAfterTop10,
    });

    const body: Record<string, unknown> = { items };
    if (wantDebug) {
      const nCompact = normCompactName(safe);
      body.debug = {
        queryRaw: searchQuery,
        queryNormalized: safe,
        queryCompact: nCompact,
        tables: [STORES_TABLE, PLACES_TABLE],
        fetchStage: stage,
        rowsAfterFetch: rows.length,
        rowsAfterQualityFilter: pipelineFiltered.length,
        itemCount: items.length,
        matchedNames: items.map((r) => r.name),
        conclusion:
          items.length > 0
            ? "db_has_matches"
            : hadError
              ? "partial_error_but_no_rows"
              : "db_likely_no_row_for_query",
      };
    }

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[place-search] data (items returned):", items.length, items.map((r) => r.name));
    }

    return NextResponse.json(body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[search-by-name]", e);
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[place-search] error:", e);
    }
    return NextResponse.json({ items: [], error: "failed" }, { status: 500 });
  }
}
