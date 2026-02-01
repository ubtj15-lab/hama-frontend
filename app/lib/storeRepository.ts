// app/lib/storeRepository.ts
"use client";

import { supabase } from "@/lib/supabaseClient";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { applyDefaultImage } from "@/lib/defaultCardImage";

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

  kakao_place_url: string | null;
  naver_place_id: string | null;

  mood: string[] | null;
  tags: string[] | null;

  with_kids: boolean | null;
  for_work: boolean | null;
  reservation_required: boolean | null;

  price_level: string | null;

  // ✅ 현재 DB에 컬럼이 없어서 제거(쿼리 400 방지)
  // curated_score: number | null;

  updated_at: string | null;
};

/** ---------- Helpers ---------- */
function tabToCategoryFilter(tab: HomeTabKey): string | null {
  if (tab === "all") return null;
  return tab;
}

function categoryToLabel(category: string | null | undefined): string {
  const c = (category ?? "").toLowerCase();
  if (c === "restaurant") return "식당";
  if (c === "cafe") return "카페";
  if (c === "salon") return "미용";
  if (c === "activity") return "액티비티";
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
  const safeImage = sanitizeImageUrl(row.image_url, false);

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

    with_kids: row.with_kids ?? null,
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
export async function fetchHomeCardsByTab(
  tab: HomeTabKey,
  options: FetchHomeOptions = {}
): Promise<HomeCard[]> {
  const count = options.count ?? (tab === "all" ? 12 : 6);
  const category = tabToCategoryFilter(tab);

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
      with_kids,
      for_work,
      reservation_required,
      price_level,
      updated_at
    `
    )
    .limit(count);

  if (category) q = q.eq("category", category);

  // ✅ 최신순만 사용 (curated_score 컬럼 없음 → 400 방지)
  q = q.order("updated_at", { ascending: false, nullsFirst: false });

  const { data, error } = await q;

  if (error) {
    console.error("[fetchHomeCardsByTab]", error);
    return [];
  }

  const rows = (data ?? []) as StoreRow[];
  return rows.map(toHomeCard);
}

/** ---------- Fetch: Nearby (Bounding box) ---------- */
export async function fetchNearbyStores(options: FetchNearbyOptions): Promise<HomeCard[]> {
  const { lat, lng, tab, radiusKm = 4, limit = 12 } = options;
  const category = tabToCategoryFilter(tab);

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
      with_kids,
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

  if (category) q = q.eq("category", category);

  // ✅ 최신순만 사용 (curated_score 컬럼 없음 → 400 방지)
  q = q.order("updated_at", { ascending: false, nullsFirst: false });

  const { data, error } = await q;

  if (error) {
    console.error("[fetchNearbyStores]", error);
    return [];
  }

  const rows = (data ?? []) as StoreRow[];
  return rows.map(toHomeCard);
}
function homeTabCount(tab: HomeTabKey): number {
  if (tab === "restaurant") return 4;
  if (tab === "cafe") return 4;
  if (tab === "salon") return 2;
  if (tab === "activity") return 2;
  return 12; // all
}
