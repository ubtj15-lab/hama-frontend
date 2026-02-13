// app/lib/storeTypes.ts

export type HomeTabKey = "all" | "restaurant" | "cafe" | "salon" | "activity";

// DB category 값이 restaurant/cafe/salon/activity 라는 전제
export type Category = Exclude<HomeTabKey, "all">;

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

// ✅ API/컴포넌트에서 쓰는 “카드 모델(표준)”
export type HomeCard = {
  id: string;

  name: string;
  category: string | null;

  // UI 표시용(없으면 category 그대로 써도 됨)
  categoryLabel?: string;

  area?: string | null;
  address?: string | null;

  lat?: number | null;
  lng?: number | null;

  phone?: string | null;

  // 이미지 키가 여기저기 섞여있어서 둘 다 허용
  image_url?: string | null;
  imageUrl?: string | null;

  kakao_place_url?: string | null;
  naver_place_id?: string | null;

  // ✅ SearchResultList에서 쓰는 placeUrl (없으면 자동 생성해서 넣어줄 거임)
  placeUrl?: string | null;

  mood?: string[];
  tags?: string[];

  // UI에서 “조용한 분위기” 같은 텍스트로 쓰는 경우가 있음
  moodText?: string;

  // “0.5km” 같이 표시하는 경우가 있어서 optional로 둠
  distanceKm?: number;

  with_kids?: boolean | null;
  for_work?: boolean | null;
  reservation_required?: boolean | null;

  price_level?: string | null;
  updated_at?: string | null;

  // 혹시 검색/추천 카드에서 쓰는 키(있으면 사용)
  quickQuery?: string;
};

// ✅ 기존 코드들이 Place 타입을 import하는 경우가 있어서 alias 제공
export type Place = HomeCard;

// ✅ API 라우트 더미에서 쓰는 타입들이 있으면 alias로 통일
export type StoreRecord = StoreRow;
export type ApiStoreItem = HomeCard;
