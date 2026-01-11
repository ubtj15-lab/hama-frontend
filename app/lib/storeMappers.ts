// app/lib/storeMappers.ts
import type { HomeCard, StoreRecord } from "./storeTypes";

export function mapStoreToHomeCard(row: StoreRecord, distanceKm?: number): HomeCard {
  return {
    id: row.id,
    name: row.name,
    categoryLabel: row.category,

    imageUrl: row.image_url ?? null,
    distanceKm: typeof distanceKm === "number" ? distanceKm : null,

    mood: row.mood,
    moodText: row.mood ?? null,

    tags: row.tags ?? [],
    withKids: row.with_kids ?? false,
    forWork: row.for_work ?? false,
    priceLevel: typeof row.price_level === "number" ? row.price_level : null,

    lat: row.lat,
    lng: row.lng,
  };
}
