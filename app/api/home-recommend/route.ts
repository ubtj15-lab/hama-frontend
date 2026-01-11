// lib/storeTypes.ts

// ✅ Supabase에서 읽어오는 원본 형태
export interface StoreRecord {
  id: string;
  name: string;
  category: string; // restaurant | cafe | salon | activity
  area: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  image_url: string | null;
  is_active: boolean;

  // 추가 속성 (있으면 쓰고 없으면 null)
  mood: string | null;
  with_kids: boolean | null;
  for_work: boolean | null;
  price_level: number | null;
  tags: string[] | null;

  // 있으면 "0.5 km" 같은 힌트(없어도 됨)
  distance_hint?: string | null;
}

// ✅ 홈 카드 타입 (UI에서 쓰는 형태)
export interface HomeCard {
  id: string;
  name: string;
  categoryLabel: string;

  // route.ts에서 계산해서 넣어줌
  distanceKm: number;

  moodText: string;
  imageUrl: string;
  quickQuery?: string;

  // 길찾기/지도용
  lat?: number | null;
  lng?: number | null;

  // 카드에서 참고
  mood?: string | null;
  withKids?: boolean | null;
  forWork?: boolean | null;
  priceLevel?: number | null;
  tags?: string[] | null;
}

/**
 * ✅ DB(StoreRecord) → UI(HomeCard) 변환 (단 하나만 유지!)
 * distanceKm은 외부에서 계산해서 넘겨줌
 */
export function mapStoreToHomeCard(store: StoreRecord, distanceKm = 0): HomeCard {
  return {
    id: store.id,
    name: store.name,
    categoryLabel: store.category,

    distanceKm: typeof distanceKm === "number" && !Number.isNaN(distanceKm) ? distanceKm : 0,

    moodText: store.mood ?? "가까운 추천 매장",
    imageUrl: store.image_url ?? "/images/sample-cafe-1.jpg",
    quickQuery: store.name,

    lat: store.lat,
    lng: store.lng,

    mood: store.mood,
    withKids: store.with_kids,
    forWork: store.for_work,
    priceLevel: store.price_level,
    tags: store.tags ?? [],
  };
}
