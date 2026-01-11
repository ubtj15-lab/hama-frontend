// app/lib/storeTypes.ts

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
}

export interface StoreRecord {
  id: string;
  name: string;
  category: string;

  lat: number | null;
  lng: number | null;

  address: string | null;
  phone: string | null;

  image_url: string | null;
  is_active: boolean;

  mood: string | null;
  with_kids: boolean | null;
  for_work: boolean | null;
  price_level: number | null;
  tags: string[] | null;
}
