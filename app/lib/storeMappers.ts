// app/lib/storeMappers.ts
import type { HomeCard } from "@/lib/storeTypes";

// 프로젝트 내 Store(혹은 stores row) 형태가 조금씩 달라도 안전하게 처리
type AnyStore = Record<string, any>;

type CanonCategory = "restaurant" | "cafe" | "salon" | "activity";

function normalizeCategory(raw: unknown): CanonCategory {
  const c = String(raw ?? "")
    .toLowerCase()
    .trim();

  // legacy
  if (c === "beauty") return "salon";

  // kakao category codes
  if (c === "fd6") return "restaurant";
  if (c === "ce7") return "cafe";
  if (c === "bk9") return "salon";
  if (c === "at4") return "activity";

  // korean hints
  if (c.includes("미용") || c.includes("헤어") || c.includes("이발")) return "salon";
  if (c.includes("카페") || c.includes("커피")) return "cafe";
  if (c.includes("식당") || c.includes("음식") || c.includes("레스토랑") || c.includes("맛집"))
    return "restaurant";
  if (c.includes("액티비") || c.includes("활동") || c.includes("체험") || c.includes("공원"))
    return "activity";

  // canonical
  if (c === "restaurant" || c === "cafe" || c === "salon" || c === "activity") return c;

  // default
  return "restaurant";
}

function labelOfCategory(cat: unknown): string {
  const c = normalizeCategory(cat);
  if (c === "restaurant") return "식당";
  if (c === "cafe") return "카페";
  if (c === "salon") return "미용실";
  return "액티비티";
}

/**
 * stores row -> HomeCard
 * - category 필수 보장
 * - 다양한 필드명 호환
 */
export function storeToHomeCard(store: AnyStore): HomeCard {
  const id = String(store?.id ?? store?.store_id ?? store?.storeId ?? "").trim();
  const name = String(store?.name ?? store?.store_name ?? store?.storeName ?? "").trim();

  const category = normalizeCategory(
    store?.category ?? store?.categoryNorm ?? store?.category_norm ?? store?.tab ?? store?.type ?? store?.kind
  );

  const categoryLabel = String(
    store?.categoryLabel ?? store?.category_label ?? labelOfCategory(category)
  );

  const distanceKmRaw =
    store?.distanceKm ??
    store?.distance_km ??
    (typeof store?.distance === "number" ? store.distance / 1000 : undefined);

  const distanceKm = Number(distanceKmRaw);
  const safeDistance = Number.isFinite(distanceKm) ? distanceKm : 0;

  const imageUrl = String(store?.imageUrl ?? store?.image_url ?? store?.image ?? store?.thumbnail ?? store?.thumb ?? "");

  const lat =
    typeof store?.lat === "number"
      ? store.lat
      : typeof store?.latitude === "number"
      ? store.latitude
      : store?.lat ?? store?.latitude ?? null;

  const lng =
    typeof store?.lng === "number"
      ? store.lng
      : typeof store?.longitude === "number"
      ? store.longitude
      : store?.lng ?? store?.longitude ?? null;

  return {
    id,
    name,

    // ✅ FIX: category 필수
    category,
    categoryLabel,

    distanceKm: safeDistance,
    moodText: String(store?.moodText ?? store?.mood_text ?? store?.mood ?? ""),
    imageUrl,

    // 아래는 프로젝트마다 nullable/any로 처리되는 필드들
    quickQuery: String(store?.quickQuery ?? store?.quick_query ?? name),
    lat,
    lng,
    mood: store?.mood ?? null,
    withKids: store?.withKids ?? store?.with_kids ?? null,
    forWork: store?.forWork ?? store?.for_work ?? null,
    priceLevel: store?.priceLevel ?? store?.price_level ?? null,
    tags: store?.tags ?? null,
  } as HomeCard;
}
