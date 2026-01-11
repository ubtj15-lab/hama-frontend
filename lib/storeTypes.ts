// app/lib/storeTypes.ts

export type StoreCategory = "restaurant" | "cafe" | "salon" | "activity" | string;

export interface HomeCard {
  id: string;
  name: string;
  categoryLabel: string;

  imageUrl?: string | null;

  distanceKm?: number | null;

  mood?: string | null;
  moodText?: string | null;

  tags?: string[] | null;

  withKids?: boolean | null;
  forWork?: boolean | null;
  priceLevel?: number | null;

  lat?: number | null;
  lng?: number | null;

  quickQuery?: string | null;
}

export interface StoreRecord {
  id: string;
  name: string;
  category: StoreCategory;

  area?: string | null;
  address?: string | null;

  lat?: number | null;
  lng?: number | null;

  phone?: string | null;
  kakao_place_url?: string | null;

  distance_hint?: string | null;
  image_url?: string | null;

  mood?: string | null;
  with_kids?: boolean | null;
  for_work?: boolean | null;
  price_level?: number | null;
  tags?: string[] | null;

  is_active?: boolean | null;
}

// ✅ 변환 함수는 여기 “하나만” 유지
export function mapStoreToHomeCard(store: StoreRecord): HomeCard {
  // distance_hint가 "0.5 km" 같은 형태면 숫자만 뽑아줌 (없으면 null)
  let distanceKm: number | null = null;
  if (store.distance_hint) {
    const num = parseFloat(store.distance_hint);
    if (!Number.isNaN(num)) distanceKm = num;
  }

  const categoryLabel =
    store.category === "restaurant"
      ? "식당"
      : store.category === "cafe"
      ? "카페"
      : store.category === "salon"
      ? "미용실"
      : store.category === "activity"
      ? "액티비티"
      : String(store.category ?? "기타");

  return {
    id: store.id,
    name: store.name,
    categoryLabel,

    imageUrl: store.image_url ?? null,

    distanceKm,

    mood: store.mood ?? null,
    moodText: store.mood ?? null,

    tags: store.tags ?? [],

    withKids: store.with_kids ?? null,
    forWork: store.for_work ?? null,
    priceLevel: typeof store.price_level === "number" ? store.price_level : null,

    lat: typeof store.lat === "number" ? store.lat : null,
    lng: typeof store.lng === "number" ? store.lng : null,

    quickQuery: store.name,
  };
}
