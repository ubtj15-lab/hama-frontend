// lib/storeTypes.ts

// Supabase에서 읽어오는 원본 형태 (stores 테이블과 1:1)
export interface StoreRecord {
  id: string;
  name: string;
  category: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  distance_hint: string | null;
  image_url: string | null;
  is_active: boolean;
}

// 홈 화면에서 쓰는 카드 타입
export interface HomeCard {
  id: string;
  name: string;
  categoryLabel: string;
  distanceKm: number;
  moodText: string;
  imageUrl: string;
  quickQuery?: string;

  // 지도/길안내에 필요한 좌표
  lat?: number | null;
  lng?: number | null;
}

// DB 레코드 → HomeCard 변환
export function mapStoreToHomeCard(store: StoreRecord): HomeCard {
  let distanceKm = 0;

  // distance_hint가 "0.5 km" 형식이라면 숫자만 가져오기
  if (store.distance_hint) {
    const num = parseFloat(store.distance_hint);
    if (!Number.isNaN(num)) distanceKm = num;
  }

  return {
    id: store.id,
    name: store.name,
    categoryLabel: store.category,
    distanceKm,
    moodText: store.distance_hint || "가까운 추천 매장",
    imageUrl: store.image_url || "/images/sample-cafe-1.jpg",
    quickQuery: store.name,

    // 👇 길찾기/지도용 필드 포함
    lat: store.lat,
    lng: store.lng,
  };
}
// Supabase에서 읽어오는 원본 형태
export interface StoreRecord {
  id: string;
  name: string;
  category: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  distance_hint: string | null;
  image_url: string | null;
  is_active: boolean;

  // 👇 새로 추가된 속성들
  mood: string | null;
  with_kids: boolean | null;
  for_work: boolean | null;
  price_level: number | null;
  tags: string[] | null;
}

// 홈 카드 타입
export interface HomeCard {
  id: string;
  name: string;
  categoryLabel: string;
  distanceKm: number;
  moodText: string;
  imageUrl: string;
  quickQuery?: string;
  lat?: number | null;
  lng?: number | null;

  // 👇 카드에서도 참고할 수 있게
  mood?: string | null;
  withKids?: boolean | null;
  forWork?: boolean | null;
  priceLevel?: number | null;
  tags?: string[] | null;
}

// 변환 함수
export function mapStoreToHomeCard(store: StoreRecord): HomeCard {
  let distanceKm = 0;
  if (store.distance_hint) {
    const num = parseFloat(store.distance_hint);
    if (!Number.isNaN(num)) distanceKm = num;
  }

  return {
    id: store.id,
    name: store.name,
    categoryLabel: store.category,
    distanceKm,
    moodText: store.distance_hint || "가까운 추천 매장",
    imageUrl: store.image_url || "/images/sample-cafe-1.jpg",
    quickQuery: store.name,
    lat: store.lat,
    lng: store.lng,

    mood: store.mood,
    withKids: store.with_kids,
    forWork: store.for_work,
    priceLevel: store.price_level,
    tags: store.tags,
  };
}

