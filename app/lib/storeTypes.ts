// lib/storeTypes.ts

export type HomeTabKey =
  | "all"
  | "restaurant"
  | "cafe"
  | "salon"
  | "activity";

/**
 * 홈 / 검색 / 추천 카드 공통 타입
 * Supabase public.stores 기준
 */
export type HomeCard = {
  id: string;

  name: string;
  category?: string | null;
  area?: string | null;
  address?: string | null;

  lat?: number | null;
  lng?: number | null;

  phone?: string | null; // ✅ 이거 추가

  imageUrl?: string | null;
  image_url?: string | null;

  kakao_place_url?: string | null;
  naver_place_id?: string | null;

  mood?: string[] | null;
  tags?: string[] | null;

  with_kids?: boolean | null;
  for_work?: boolean | null;
  reservation_required?: boolean | null;

  price_level?: string | null;
  updated_at?: string | null;
};

