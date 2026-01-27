// app/lib/storeRepository.ts
import { supabase } from "@/lib/supabaseClient";
import type { HomeCard, HomeTabKey, StoreRow } from "@/lib/storeTypes";

type FetchHomeOptions = {
  count?: number;
};

type FetchNearbyOptions = {
  lat: number;
  lng: number;
  tab: HomeTabKey;
  radiusKm?: number;
  limit?: number;
};

function tabToCategoryFilter(tab: HomeTabKey): string | null {
  if (tab === "all") return null;
  return tab;
}

function moodArrayToText(mood?: string[] | null) {
  if (!mood || mood.length === 0) return "";
  return mood.filter(Boolean).join(" · ");
}

// ✅ StoreRow -> HomeCard 변환(표준)
export function toHomeCard(row: StoreRow): HomeCard {
  const image = row.image_url ?? null;

  return {
    id: row.id,
    name: row.name ?? "",
    category: row.category ?? null,

    area: row.area ?? null,
    address: row.address ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    phone: row.phone ?? null,

    image_url: image,
    imageUrl: image,

    kakao_place_url: row.kakao_place_url ?? null,
    naver_place_id: row.naver_place_id ?? null,

    // ⚠️ placeUrl은 “공용 링크”로 쓰면 반드시 꼬임.
    // - 네이버/카카오 분기는 app/lib/placeLinks.ts가 담당하게 두는 게 안전함.
    // - 유지하더라도 여기서는 null로 두는 게 사고가 없음.
    placeUrl: null,

    mood: row.mood ?? [],
    tags: row.tags ?? [],
    moodText: moodArrayToText(row.mood),

    with_kids: row.with_kids ?? null,
    for_work: row.for_work ?? null,
    reservation_required: row.reservation_required ?? null,

    price_level: row.price_level ?? null,
    updated_at: row.updated_at ?? null,
  };
}

/**
 * 홈(추천) 카드: 탭 기준으로 일정 개수 가져오기
 */
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

/**
 * 근처(탐색) 카드: 바운딩박스 버전(PostGIS 없이)
 */
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
