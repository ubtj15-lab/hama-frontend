// lib/storeMappers.ts
import type { StoreRecord, HomeCard } from "./storeTypes";

export function mapStoreToHomeCard(row: StoreRecord): HomeCard {
  return {
    id: row.id,
    name: row.name,
    categoryLabel: row.category ?? "기타",

    imageUrl: row.kakao_place_url ?? undefined,
    distanceKm: null, // 홈에서는 계산 안 함

    mood: Array.isArray(row.mood) ? row.mood[0] : null,
    moodText: null,

    tags: row.tags ?? [],
    withKids: row.with_kids ?? false,
    forWork: row.for_work ?? false,
    priceLevel: row.price_level ?? null,

    quickQuery: row.name,
  };
}
