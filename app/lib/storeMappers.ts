// lib/storeMappers.ts
import type { HomeCard, StoreRecord } from "./storeTypes";

function categoryToLabel(category: string) {
  switch (category) {
    case "restaurant":
      return "식당";
    case "cafe":
      return "카페";
    case "salon":
      return "미용실";
    case "activity":
      return "액티비티";
    default:
      return category || "기타";
  }
}

export function mapStoreToHomeCard(store: StoreRecord, distanceKm: number): HomeCard {
  const safeDistance = Number.isFinite(distanceKm) ? distanceKm : 0;

  return {
    id: store.id,
    name: store.name,

    categoryLabel: categoryToLabel(store.category),

    distanceKm: safeDistance,

    moodText: store.distance_hint || "가까운 추천 매장",
    imageUrl: store.image_url || "/images/sample-cafe-1.jpg",
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
