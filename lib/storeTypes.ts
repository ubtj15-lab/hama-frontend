export type HomeCard = {
  id: string;
  name: string;
  categoryLabel: string;

  imageUrl?: string | null;
  distanceKm?: number | null;

  mood?: string | null;
  moodText?: string | null;

  tags?: string[];
  withKids?: boolean;
  forWork?: boolean;
  priceLevel?: number | null;

  quickQuery?: string | null;
};

export type StoreRecord = {
  id: string;
  name: string;
  category: string | null;
  area: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  kakao_place_url: string | null;
  source: string | null;

  mood: string | null;
  with_kids: boolean | null;
  for_work: boolean | null;
  price_level: number | null;
  tags: string[] | null;

  image_url?: string | null;
};
