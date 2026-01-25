import { supabase } from "@/lib/supabaseClient";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";

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

type StoreRow = {
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

function toHomeCard(row: StoreRow): HomeCard {
  return {
    id: row.id,
    name: row.name ?? "",
    category: row.category,
    area: row.area,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    phone: row.phone ?? null,
    image_url: row.image_url ?? null,
    imageUrl: row.image_url ?? null,
    kakao_place_url: row.kakao_place_url ?? null,
    naver_place_id: row.naver_place_id ?? null,
    mood: row.mood ?? [],
    tags: row.tags ?? [],
    with_kids: row.with_kids ?? null,
    for_work: row.for_work ?? null,
    reservation_required: row.reservation_required ?? null,
    price_level: row.price_level ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function tabToCategoryFilter(tab: HomeTabKey): string | null {
  if (tab === "all") return null;
  // DB category 값이 restaurant/cafe/salon/activity 라는 전제
  return tab;
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

  // 추천은 최신 업데이트 우선(원하면 random으로 바꿔도 됨)
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
 * 근처(탐색) 카드: 현재 좌표 기준으로 반경 대략 필터링(바운딩박스)
 * - PostGIS 없이도 돌아가게 만든 버전
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

  // 바운딩박스라서, 마지막에 “대략 거리”로 한 번 더 걸러도 됨(선택)
  // 지금은 일단 빠르게 오베용으로 통과시킴.
  return rows.map(toHomeCard);
}
