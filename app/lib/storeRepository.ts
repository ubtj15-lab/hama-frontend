// lib/storeRepository.ts
import type { HomeCard } from "@/lib/storeTypes";

// ----------------------
// category 유틸
// ----------------------
type CanonCategory = "restaurant" | "cafe" | "salon" | "activity";

function normalizeCategory(v: unknown): CanonCategory {
  const s = String(v ?? "").toLowerCase().trim();

  if (s === "restaurant" || s.includes("rest") || s.includes("식당") || s.includes("레스토랑"))
    return "restaurant";
  if (s === "cafe" || s.includes("caf") || s.includes("카페")) return "cafe";
  if (s === "salon" || s.includes("beauty") || s.includes("미용") || s.includes("헤어"))
    return "salon";
  if (s === "activity" || s.includes("activ") || s.includes("액티") || s.includes("체험"))
    return "activity";

  // 서버가 tab으로 내려주거나 type/kind가 비어있는 경우가 있어서 기본값
  return "restaurant";
}

function labelOfCategory(c: CanonCategory) {
  if (c === "restaurant") return "식당";
  if (c === "cafe") return "카페";
  if (c === "salon") return "미용실";
  return "액티비티";
}

// ----------------------
// ✅ nearBy/추천/혼합 응답 다 받는 매퍼
// ----------------------
export function toHomeCard(r: any): HomeCard {
  const id = String(
    r?.id ??
      r?.store_id ??
      r?.storeId ??
      r?.place_id ??
      r?.placeId ??
      r?.uuid ??
      ""
  ).trim();

  const name = String(
    r?.name ??
      r?.store_name ??
      r?.storeName ??
      r?.title ??
      r?.place_name ??
      ""
  ).trim();

  const categoryRaw =
    r?.category ??
    r?.categoryNorm ??
    r?.category_norm ??
    r?.tab ??
    r?.type ??
    r?.kind ??
    "";

  const category = normalizeCategory(categoryRaw);

  const imageUrl = String(
    r?.imageUrl ?? r?.image_url ?? r?.image ?? r?.thumbnail ?? r?.thumb ?? ""
  );

  const lat =
    typeof r?.lat === "number"
      ? r.lat
      : typeof r?.latitude === "number"
      ? r.latitude
      : typeof r?.lat === "string"
      ? Number(r.lat)
      : null;

  const lng =
    typeof r?.lng === "number"
      ? r.lng
      : typeof r?.longitude === "number"
      ? r.longitude
      : typeof r?.lng === "string"
      ? Number(r.lng)
      : null;

  return {
    id,
    name,
    category, // ✅ HomeCard.required
    categoryLabel: String(r?.categoryLabel ?? r?.category_label ?? labelOfCategory(category)),
    distanceKm:
      typeof r?.distanceKm === "number"
        ? r.distanceKm
        : typeof r?.distance_km === "number"
        ? r.distance_km
        : 0,
    moodText: String(r?.moodText ?? r?.mood_text ?? r?.mood ?? ""),
    imageUrl,
    lat: Number.isFinite(lat as number) ? (lat as number) : null,
    lng: Number.isFinite(lng as number) ? (lng as number) : null,
    mood: r?.mood ?? null,
    withKids: r?.withKids ?? r?.with_kids ?? null,
    forWork: r?.forWork ?? r?.for_work ?? null,
    priceLevel: r?.priceLevel ?? r?.price_level ?? null,
    tags: r?.tags ?? null,
  };
}

// ----------------------
// ✅ 탭별 홈 추천 fetch
// ----------------------
export async function fetchHomeCardsByTab(tab: string, options?: { count?: number }) {
  const count = options?.count ?? 12;

  const res = await fetch(
    `/api/home-recommend?tab=${encodeURIComponent(tab)}&count=${count}`,
    { cache: "no-store" }
  );

  if (!res.ok) throw new Error("failed to fetch home cards");

  const json = await res.json();
  const items = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];

  return items.map(toHomeCard);
}
