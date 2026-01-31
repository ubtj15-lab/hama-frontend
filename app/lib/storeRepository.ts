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
 * ✅ 핵심: image_url "안전 필터"
 * - 지금 단계에서는 외부 핫링크(카카오/네이버/랜덤 CDN)가 깨질 확률이 높아서 기본적으로 차단
 * - 로컬(public) 경로(/images/...) 만 통과시켜서 "깨진 이미지"를 원천 차단
 *
 * 만약 나중에 네가 S3/Cloudflare 같은 안정적인 CDN URL을 넣을 거면,
 * allowHttp 를 true로 바꾸면 됨.
 */
function sanitizeImageUrl(input: string | null | undefined, allowHttp = false): string | null {
  const v = (input ?? "").trim();
  if (!v) return null;

  // 로컬 정적 파일만 허용 (public 아래)
  if (v.startsWith("/")) return v;

  // 안정적인 외부 CDN을 쓰기 시작하면 이 옵션을 true로
  if (allowHttp && (v.startsWith("http://") || v.startsWith("https://"))) return v;

  // 그 외는 전부 무시 -> 기본 이미지로 가게 만들기
  return null;
}

/** ---------- Row -> HomeCard ---------- */
export function toHomeCard(row: StoreRow): HomeCard {
  const safeImage = sanitizeImageUrl(row.image_url, false); // ✅ 지금은 외부 URL 차단

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

    // ✅ 여기서 깨질 수 있는 외부/이상한 값은 null 처리됨
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
    updated_at: row.updated_at ?? null,
  };

  // ✅ safeImage가 null이면 무조건 기본 이미지가 주입됨
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

  q = q.order("updated_at", { ascending: false, nullsFirst: false });

  const { data, error } = await q;

  if (error) {
    console.error("[fetchNearbyStores]", error);
    return [];
  }

  const rows = (data ?? []) as StoreRow[];
  return rows.map(toHomeCard);
}
