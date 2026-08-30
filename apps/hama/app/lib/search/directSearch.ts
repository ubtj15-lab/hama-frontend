import { toHomeCard, type StoreRow } from "@/lib/storeRepository";
import type { HomeCard } from "@/lib/storeTypes";
import { matchNamedFoodPreset } from "@/lib/recommend/namedFoodPresets";
import { normalizeBrandQuery } from "@/lib/results/placeNameSearchIntent";
import {
  getOrCreateHamaSearchSeed,
  getRecentExposedIdsHeaderValue,
  getRecentExposedNamesHeaderValue,
} from "@/lib/searchDiversityClient";
import { expandSearchQuery, matchSynonymGroupsInQuery, SEARCH_SYNONYM_GROUPS } from "@/lib/searchSynonyms";

const GENERIC_FOOD_DIRECT_QUERIES = new Set(["푸드", "식당", "맛집"]);

function normalizeDirectSearchKey(query: string): string {
  return String(query ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

/**
 * URL/검색창에 사용자가 직접 입력한 음식·메뉴 검색어인지 (시나리오·상황 프리셋 제외).
 */
export function isDirectSearchModeQuery(query: string | null | undefined): boolean {
  const raw = String(query ?? "").trim();
  if (raw.length < 2) return false;
  const key = normalizeDirectSearchKey(raw);
  if (SEARCH_SYNONYM_GROUPS[key]) return true;
  if (matchSynonymGroupsInQuery(raw).length > 0) return true;
  if (matchNamedFoodPreset(raw)) return true;
  const norm = normalizeBrandQuery(raw);
  if (GENERIC_FOOD_DIRECT_QUERIES.has(norm)) return true;
  return false;
}

/** `/api/stores/search-by-name` — `query` 우선, API는 `q` fallback */
export function buildSearchByNameApiParams(
  query: string,
  extra?: Record<string, string | undefined>
): URLSearchParams {
  const params = new URLSearchParams({ query: String(query ?? "").trim() });
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value != null && String(value).length > 0) params.set(key, String(value));
    }
  }
  return params;
}

export function buildSearchByNameApiUrl(
  query: string,
  extra?: Record<string, string | undefined>
): string {
  return `/api/stores/search-by-name?${buildSearchByNameApiParams(query, extra).toString()}`;
}

/** search-by-name API — Supabase menu_keywords/search_keywords 확장 검색 */
export async function fetchDirectSearchHomeCards(query: string): Promise<HomeCard[]> {
  const q = String(query ?? "").trim();
  if (q.length < 2) return [];

  try {
    const seed = getOrCreateHamaSearchSeed();
    const headers: Record<string, string> = {};
    if (seed) headers["x-hama-search-seed"] = seed;
    const recentIds = getRecentExposedIdsHeaderValue();
    if (recentIds) headers["x-hama-recent-exposed-ids"] = recentIds;
    const recentNames = getRecentExposedNamesHeaderValue();
    if (recentNames) headers["x-hama-recent-exposed-names"] = recentNames;

    const res = await fetch(
      buildSearchByNameApiUrl(query, {
        debug: process.env.NODE_ENV === "development" ? "1" : undefined,
      }),
      {
      cache: "no-store",
      headers: Object.keys(headers).length ? headers : undefined,
    }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      items?: StoreRow[];
      supabaseErrors?: { menu?: string | null; search?: string | null };
      merged?: number;
      menuKeywordHits?: number;
    };
    if (process.env.NODE_ENV !== "production") {
      logDirectSearchPipeline("[SEARCH_API_RESULT_COUNT]", {
        query,
        count: (json.items ?? []).length,
        merged: json.merged,
        menuKeywordHits: json.menuKeywordHits,
        supabaseErrors: json.supabaseErrors,
      });
    }
    return (json.items ?? []).map((row) => toHomeCard(row));
  } catch {
    return [];
  }
}

export async function fetchDirectSearchStoreRows(query: string): Promise<StoreRow[]> {
  const cards = await fetchDirectSearchHomeCards(query);
  return cards.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category ?? null,
    area: c.area ?? null,
    address: c.address ?? null,
    lat: c.lat ?? null,
    lng: c.lng ?? null,
    phone: c.phone ?? null,
    image_url: c.image_url ?? c.imageUrl ?? null,
    kakao_place_url: c.kakao_place_url ?? null,
    naver_place_id: c.naver_place_id ?? null,
    mood: c.mood ?? null,
    tags: c.tags ?? null,
    menu_keywords: c.menu_keywords ?? null,
    search_keywords: (c as { search_keywords?: string[] | null }).search_keywords ?? null,
    with_kids: c.with_kids ?? null,
    for_work: c.for_work ?? null,
    reservation_required: c.reservation_required ?? null,
    price_level: c.price_level ?? null,
    updated_at: c.updated_at ?? null,
  }));
}

export function logDirectSearchPipeline(step: string, payload: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  console.log(step, payload);
}
