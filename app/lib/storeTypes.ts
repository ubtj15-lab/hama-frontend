// app/lib/storeTypes.ts

// Supabase에서 읽어오는 원본 형태(필요한 것만)
export interface StoreRecord {
  id: string;
  name: string;
  category: string; // restaurant | cafe | salon | activity ...
  lat: number | null;
  lng: number | null;
  address: string | null;
  distance_hint?: string | null;
  image_url?: string | null;
  is_active?: boolean;

  // 옵션 필드들(있으면 쓰고 없으면 null)
  mood?: string | null;
  with_kids?: boolean | null;
  for_work?: boolean | null;
  price_level?: number | null;
  tags?: string[] | null;
}

export interface HomeCard {
  id: string;
  name: string;
  categoryLabel: string; // UI 표시용
  distanceKm: number;
  moodText: string;
  imageUrl: string;
  quickQuery?: string;

  lat?: number | null;
  lng?: number | null;

  mood?: string | null;
  withKids?: boolean | null;
  forWork?: boolean | null;
  priceLevel?: number | null;
  tags?: string[] | null;
}

// ✅ 이 함수는 “파일 안에 단 한 번만” 존재해야 함
export function mapStoreToHomeCard(
  store: StoreRecord,
  distanceKm: number
): HomeCard {
  const safeDistance = Number.isFinite(distanceKm) ? distanceKm : 0;

  return {
    id: store.id,
    name: store.name,
    categoryLabel: store.category,
    distanceKm: safeDistance,
    moodText: store.mood ?? store.distance_hint ?? "가까운 추천 매장",
    imageUrl: store.image_url ?? "/images/sample-cafe-1.jpg",
    quickQuery: store.name,

    lat: store.lat,
    lng: store.lng,

    mood: store.mood ?? null,
    withKids: store.with_kids ?? null,
    forWork: store.for_work ?? null,
    priceLevel: store.price_level ?? null,
    tags: store.tags ?? null,
  };
}
