// app/lib/storeRepository.ts
"use client";

import { supabase } from "@hama/shared";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { applyDefaultImage } from "@/lib/defaultCardImage";
import { filterRowsByServiceRegion } from "@/lib/serviceRegion";
import { categoriesForHomeTab } from "@/lib/storeCategoryFilters";
import {
  RECOMMEND_POOL_PER_CATEGORY_MIXED,
  RECOMMEND_POOL_SINGLE_TAB,
} from "@/lib/recommend/recommendConstants";

/** ---------- Options ---------- */
export type FetchHomeOptions = {
  count?: number;
};

export type FetchNearbyOptions = {
  lat: number;
  lng: number;
  tab: HomeTabKey;
  radiusKm?: number;
  limit?: number;
};

/** ---------- DB Row Type (stores table) ---------- */
export type StoreRow = {
  id: string;

  name: string | null;
  category: string | null;
  area: string | null;
  address: string | null;

  lat: number | null;
  lng: number | null;

  phone: string | null;

  image_url: string | null;
  cover_image_url?: string | null;

  kakao_place_url: string | null;
  naver_place_id: string | null;

  mood: string[] | null;
  tags: string[] | null;

  description?: string | null;
  menu_keywords?: string[] | null;
  food_sub_category?: string | null;

  with_kids: boolean | null;
  hama_pay_enabled?: boolean | null;
  for_work: boolean | null;
  reservation_required: boolean | null;

  price_level: string | null;

  // ✅ 현재 DB에 컬럼이 없어서 제거(쿼리 400 방지)
  // curated_score: number | null;

  updated_at: string | null;
};

/** ---------- Helpers ---------- */
export { categoriesForHomeTab };

function categoryToLabel(category: string | null | undefined): string {
  const c = (category ?? "").toLowerCase();
  if (c === "restaurant" || c === "fd6") return "식당";
  if (c === "cafe" || c === "ce7") return "카페";
  if (c === "salon" || c === "bk9" || c === "beauty") return "미용";
  if (c === "activity" || c === "at4") return "액티비티";
  if (c === "museum" || c === "culture" || c === "gallery" || c === "exhibition") return "문화";
  return "장소";
}

function moodArrayToText(mood: string[] | null | undefined): string {
  if (!Array.isArray(mood) || mood.length === 0) return "";
  return mood.slice(0, 2).join(" · ");
}

/**
 * ✅ image_url "안전 필터"
 * - 로컬(public) 경로(/images/...)만 통과
 * - 외부 URL은 기본 차단 -> 깨진 이미지 방지
 */
function sanitizeImageUrl(input: string | null | undefined, allowHttp = false): string | null {
  const v = (input ?? "").trim();
  if (!v) return null;

  if (v.startsWith("/")) return v;
  if (allowHttp && (v.startsWith("http://") || v.startsWith("https://"))) return v;

  return null;
}

/** ---------- Row -> HomeCard ---------- */
export function toHomeCard(row: StoreRow): HomeCard {
  const safeImage =
    sanitizeImageUrl((row as any).cover_image_url, true) ??
    sanitizeImageUrl(row.image_url, false);

  const card: any = {
    id: row.id,
    name: row.name ?? "",

    category: row.category ?? null,
    categoryLabel: categoryToLabel(row.category),

    area: row.area ?? null,
    address: row.address ?? null,

    lat: row.lat ?? null,
    lng: row.lng ?? null,

    phone: row.phone ?? null,

    image_url: safeImage,
    imageUrl: safeImage,

    kakao_place_url: row.kakao_place_url ?? null,
    naver_place_id: row.naver_place_id ?? null,

    mood: row.mood ?? [],
    moodText: moodArrayToText(row.mood),

    tags: row.tags ?? [],

    ...(Array.isArray((row as StoreRow).menu_keywords) && (row as StoreRow).menu_keywords!.length
      ? { menu_keywords: (row as StoreRow).menu_keywords }
      : {}),
    ...((row as StoreRow).description
      ? { description: (row as StoreRow).description }
      : {}),
    ...((row as StoreRow).food_sub_category
      ? { food_sub_category: (row as StoreRow).food_sub_category }
      : {}),

    with_kids: row.with_kids ?? null,
    hama_pay_enabled: (row as StoreRow).hama_pay_enabled ?? null,
    for_work: row.for_work ?? null,
    reservation_required: row.reservation_required ?? null,

    price_level: row.price_level ?? null,

    // ✅ curated_score 컬럼이 없으니 기본값만(호환용)
    curated_score: 0,

    updated_at: row.updated_at ?? null,
  };

  return applyDefaultImage(card as HomeCard);
}

/** ---------- Fetch: Home Cards ---------- */
const STORES_HOME_CARD_SELECT = `
      id,
      name,
      category,
      area,
      address,
      lat,
      lng,
      phone,
      image_url,
      kakao_place_url,
      naver_place_id,
      mood,
      tags,
      description,
      menu_keywords,
      food_sub_category,
      with_kids,
      hama_pay_enabled,
      for_work,
      reservation_required,
      price_level,
      updated_at
    `;

function fetchTabAuditSamples(cards: HomeCard[]) {
  return cards.slice(0, 10).map((card) => ({
    name: card.name,
    category: card.category,
    categoryLabel: card.categoryLabel,
    tags: card.tags,
    mood: card.mood,
  }));
}

export async function fetchHomeCardsByTab(
  tab: HomeTabKey,
  options: FetchHomeOptions = {}
): Promise<HomeCard[]> {
  const count = options.count ?? (tab === "all" ? 12 : 6);
  const categories = categoriesForHomeTab(tab);

  let q = supabase.from("stores").select(STORES_HOME_CARD_SELECT).limit(count);

  if (categories && categories.length > 0) {
    q = q.in("category", categories);
  }

  // ✅ 최신순만 사용 (curated_score 컬럼 없음 → 400 방지)
  q = q.order("updated_at", { ascending: false, nullsFirst: false });

  const { data, error } = await q;

  if (error) {
    console.error("[fetchHomeCardsByTab]", { tab, categories, error });
    return [];
  }

  const rows = filterRowsByServiceRegion((data ?? []) as StoreRow[]);
  const cards = rows.map(toHomeCard);
  console.log("[fetch tab audit]", {
    tab,
    categories: categories ?? "all",
    count: cards.length,
    samples: fetchTabAuditSamples(cards),
  });
  return cards;
}

function sanitizeCultureIlikeToken(t: string): string {
  return String(t ?? "")
    .replace(/[%_]/g, "")
    .trim()
    .slice(0, 40);
}

/** 단일 토큰 — `박물관` 매장명 검색과 동일한 ilike 패턴 */
async function fetchCultureStoresBySingleNameToken(token: string, limit: number): Promise<HomeCard[]> {
  const safe = sanitizeCultureIlikeToken(token);
  if (safe.length < 2) return [];
  const { data, error } = await supabase
    .from("stores")
    .select(STORES_HOME_CARD_SELECT)
    .ilike("name", `%${safe}%`)
    .not("name", "is", null)
    .neq("name", "")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(Math.min(80, Math.max(10, limit)));

  if (error) {
    console.error("[fetchCultureStoresBySingleNameToken]", { token: safe, error });
    return [];
  }
  const rows = filterRowsByServiceRegion((data ?? []) as StoreRow[]);
  return rows.map(toHomeCard);
}

/** 문화 버튼 browse — 카테고리 탭에 없는 박물관 행을 이름 ilike로 보강 (매장명 검색과 동일 원천) */
export async function fetchCultureStoresByNameHints(options: { limit?: number } = {}): Promise<HomeCard[]> {
  const limit = Math.min(120, Math.max(20, options.limit ?? 60));
  const orClause = [
    "name.ilike.%박물관%",
    "name.ilike.%미술관%",
    "name.ilike.%전시관%",
    "name.ilike.%과학관%",
    "name.ilike.%기념관%",
    "name.ilike.%도서관%",
    "name.ilike.%기록매체박물관%",
    "name.ilike.%문화센터%",
    "name.ilike.%문화의집%",
    "name.ilike.%갤러리%",
    "name.ilike.%전시장%",
    "name.ilike.%역사박물관%",
    "name.ilike.%전시%",
  ].join(",");
  const { data, error } = await supabase
    .from("stores")
    .select(STORES_HOME_CARD_SELECT)
    .or(orClause)
    .not("name", "is", null)
    .neq("name", "")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("[fetchCultureStoresByNameHints]", error);
    return [];
  }
  const rows = filterRowsByServiceRegion((data ?? []) as StoreRow[]);
  return rows.map(toHomeCard);
}

/**
 * 문화 버튼 전용: 기본 OR + (행 부족 시) 박물관/미술관/전시관/도서관 단일 ilike 체인.
 * 복합 q와 무관하게 검색창 "박물관"과 유사한 후보를 확보.
 */
export async function fetchCultureStoresByNameHintsChained(options: {
  limitDefault?: number;
  limitPerToken?: number;
  queryLabel?: string | null;
} = {}): Promise<{ cards: HomeCard[]; hintQueriesTried: string[]; perStepCounts: Record<string, number> }> {
  const hintQueriesTried: string[] = [];
  const perStepCounts: Record<string, number> = {};
  const byId = new Map<string, HomeCard>();

  const mergeIn = (arr: HomeCard[], key: string) => {
    perStepCounts[key] = arr.length;
    for (const c of arr) {
      const id = String((c as any)?.id ?? "");
      if (id && !byId.has(id)) byId.set(id, c);
    }
  };

  const defaultBatch = await fetchCultureStoresByNameHints({ limit: options.limitDefault ?? 80 });
  hintQueriesTried.push("default_or");
  mergeIn(defaultBatch, "default_or");

  const TOKENS = ["박물관", "미술관", "전시관", "도서관"];
  if (byId.size < 15) {
    for (const tok of TOKENS) {
      hintQueriesTried.push(tok);
      const batch = await fetchCultureStoresBySingleNameToken(tok, options.limitPerToken ?? 45);
      mergeIn(batch, tok);
    }
  }

  const cards = Array.from(byId.values());
  console.log("[culture name hint fetch]", {
    query: options.queryLabel ?? null,
    called: true,
    count: cards.length,
    hintQueriesTried,
    perStepCounts,
    samples: cards.slice(0, 10).map((c) => ({
      name: c.name,
      category: c.category,
      categoryLabel: c.categoryLabel,
      tags: c.tags,
      mood: c.mood,
    })),
  });

  return { cards, hintQueriesTried, perStepCounts };
}

/** 홈 점수 추천용: 탭별로 더 많이 가져와 클라이언트에서 랭킹 */
export async function fetchHomeRecommendCandidates(tab: HomeTabKey): Promise<HomeCard[]> {
  if (tab === "all") {
    const per = RECOMMEND_POOL_PER_CATEGORY_MIXED;
    const [restaurants, cafes, salons, activities] = await Promise.all([
      fetchHomeCardsByTab("restaurant", { count: per }),
      fetchHomeCardsByTab("cafe", { count: per }),
      fetchHomeCardsByTab("salon", { count: per }),
      fetchHomeCardsByTab("activity", { count: per }),
    ]);
    const byId = new Map<string, HomeCard>();
    for (const c of [...restaurants, ...cafes, ...salons, ...activities]) {
      if (!byId.has(c.id)) byId.set(c.id, c);
    }
    const merged = Array.from(byId.values());
    const cat = (c: HomeCard | null | undefined) => String(c?.category ?? "").toLowerCase();
    const cafeCat = (c: HomeCard) => ["cafe", "ce7"].includes(cat(c));
    const beautyCat = (c: HomeCard) => ["salon", "bk9", "beauty"].includes(cat(c));
    const museumCat = (c: HomeCard) => ["museum", "culture", "gallery", "exhibition"].includes(cat(c));
    const cultureBlob = (c: HomeCard) => {
      const blob = `${c.name ?? ""} ${(c.tags ?? []).join(" ")}`.toLowerCase();
      return /박물관|미술관|전시관|전시|도서관|museum|gallery|exhibition/.test(blob);
    };
    console.log("[fetch all audit]", {
      count: merged.length,
      cafeSamples: merged.filter(cafeCat).slice(0, 10).map((c) => ({ name: c.name, category: c.category })),
      beautySamples: merged.filter(beautyCat).slice(0, 10).map((c) => ({ name: c.name, category: c.category })),
      cultureSamples: merged.filter((c) => cultureBlob(c) && !museumCat(c)).slice(0, 10).map((c) => ({
        name: c.name,
        category: c.category,
      })),
      museumSamples: merged.filter(museumCat).slice(0, 10).map((c) => ({ name: c.name, category: c.category })),
    });
    return merged;
  }
  return fetchHomeCardsByTab(tab, { count: RECOMMEND_POOL_SINGLE_TAB });
}

/**
 * 코스 생성 전용: 탭과 무관하게 역할별(식사/액티비티/카페) 후보를 확보.
 * 미용실(salon)은 기본 코스에서 제외(뷰티는 별도 플로우로 두기 위함).
 */
export async function fetchHomeCourseCandidatePool(): Promise<HomeCard[]> {
  const per = RECOMMEND_POOL_PER_CATEGORY_MIXED;
  const [restaurants, cafes, activities] = await Promise.all([
    fetchHomeCardsByTab("restaurant", { count: per }),
    fetchHomeCardsByTab("cafe", { count: per }),
    fetchHomeCardsByTab("activity", { count: per }),
  ]);
  const byId = new Map<string, HomeCard>();
  for (const c of [...restaurants, ...cafes, ...activities]) {
    if (!byId.has(c.id)) byId.set(c.id, c);
  }
  return Array.from(byId.values());
}

/** ---------- Fetch: Nearby (Bounding box) ---------- */
export async function fetchNearbyStores(options: FetchNearbyOptions): Promise<HomeCard[]> {
  const { lat, lng, tab, radiusKm = 4, limit = 12 } = options;
  const categories = categoriesForHomeTab(tab);

  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  let q = supabase
    .from("stores")
    .select(
      `
      id,
      name,
      category,
      area,
      address,
      lat,
      lng,
      phone,
      image_url,
      kakao_place_url,
      naver_place_id,
      mood,
      tags,
      description,
      menu_keywords,
      food_sub_category,
      with_kids,
      hama_pay_enabled,
      for_work,
      reservation_required,
      price_level,
      updated_at
    `
    )
    .gte("lat", minLat)
    .lte("lat", maxLat)
    .gte("lng", minLng)
    .lte("lng", maxLng)
    .limit(limit);

  if (categories && categories.length > 0) {
    q = q.in("category", categories);
  }

  // ✅ 최신순만 사용 (curated_score 컬럼 없음 → 400 방지)
  q = q.order("updated_at", { ascending: false, nullsFirst: false });

  const { data, error } = await q;

  if (error) {
    console.error("[fetchNearbyStores]", error);
    return [];
  }

  const rows = filterRowsByServiceRegion((data ?? []) as StoreRow[]);
  return rows.map(toHomeCard);
}
function homeTabCount(tab: HomeTabKey): number {
  if (tab === "restaurant") return 4;
  if (tab === "cafe") return 4;
  if (tab === "salon") return 2;
  if (tab === "activity") return 2;
  return 12; // all
}
