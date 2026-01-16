// app/lib/storeTypes.ts

export type HomeTabKey =
  | "all"
  | "cafe"
  | "restaurant"
  | "activity"
  | "salon"
  | "beauty";

export interface StoreRecord {
  id: string;
  name: string;
  category: string;
  area: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;

  image_url?: string | null;
  distance_hint?: string | null;
  is_active?: boolean;

  mood?: string | null;
  with_kids?: boolean | null;
  for_work?: boolean | null;
  price_level?: number | null;
  tags?: string[] | null;
}

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

  mood?: string | null;
  withKids?: boolean | null;
  forWork?: boolean | null;
  priceLevel?: number | null;
  tags?: string[] | null;
}

export type HamaUser = {
  id: string;
  nickname?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  role?: "user" | "admin" | null;
  points?: number | null;
};

// 검색/추천 카드 공용 타입 (중요: export type Place)
export type Place = {
  id: string;
  name: string;
  category?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  imageUrl?: string | null;
  phone?: string | null;

  distance?: number | null;   // meters
  placeUrl?: string | null;
};
