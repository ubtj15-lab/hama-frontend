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
  // DB category 값이 restaurant/cafe/salon/activity 라는 전제
  return tab;
}

// naver_place_id가 있으면 “모바일 상세”로 바로 열릴 확률이 높음
function naverMobilePlaceUrl(naver_place_id: string) {
  return `https://m.place.naver.com/place/${naver_place_id}`;
}

// mood가 배열이면 UI에서 스트링으로 표시할 때 쓰기 좋게
function moodArrayToText(mood?: string[] | null) {
  if (!mood || mood.length === 0) return "";
  return mood.join(", ");
}

// ✅ StoreRow -> HomeCard 변환(프로젝트 전체에서 이걸 표준으로 쓰게)
export function toHomeCard(row: StoreRow): HomeCard {
  const image = row.image_url ?? null;

  const placeUrl =
    row.kakao_place_url ??
    (row.naver_place_id ? naverMobilePlaceUrl(row.naver_place_id) : null);

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
    placeUrl,

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
 * 근처(탐색) 카드: PostGIS 없이도 돌아가게 만든 바운딩박스 버전
 */
export async function fetchNearbyStores(options: FetchNearbyOptions): Promise<HomeCard[]> {
  const { lat, lng, tab, radiusKm = 4, limit = 12 } = options;
  const category = tabToCategoryFilter(tab);

  // 위도 1도 ≈ 111km
  const latDelta = radiusKm / 111;
  // 경도는 위도에 따라 달라짐
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
