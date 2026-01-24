// app/lib/storeRepository.ts
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";

// ===============================
// Category helpers
// ===============================
type CanonCategory = "restaurant" | "cafe" | "salon" | "activity";

function normalizeCategory(raw: unknown): CanonCategory {
  const c = String(raw ?? "").toLowerCase().trim();

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
  if (
    c.includes("식당") ||
    c.includes("음식") ||
    c.includes("레스토랑") ||
    c.includes("맛집")
  )
    return "restaurant";
  if (
    c.includes("액티비") ||
    c.includes("활동") ||
    c.includes("체험") ||
    c.includes("공원") ||
    c.includes("박물관")
  )
    return "activity";

  // canonical
  if (c === "restaurant" || c === "cafe" || c === "salon" || c === "activity") return c;

  // safe default
  return "restaurant";
}

export function labelOfCategory(cat: unknown): string {
  const c = normalizeCategory(cat);
  if (c === "restaurant") return "식당";
  if (c === "cafe") return "카페";
  if (c === "salon") return "미용실";
  return "액티비티";
}

// ===============================
// Tab normalize
// - "beauty" 등 legacy 들어와도 HomeTabKey로 강제 변환
// ===============================
export function normalizeTab(raw: unknown): HomeTabKey {
  const t = String(raw ?? "all").toLowerCase().trim();

  if (t === "beauty") return "salon";
  if (t === "종합" || t === "total") return "all";

  if (t === "all" || t === "restaurant" || t === "cafe" || t === "salon" || t === "activity")
    return t;

  return "all";
}

// ===============================
// Mapper
// - home-recommend / nearby / mixed response 모두 수용
// ===============================
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
    r?.name ?? r?.store_name ?? r?.storeName ?? r?.title ?? r?.place_name ?? ""
  ).trim();

  const category = normalizeCategory(
    r?.category ?? r?.categoryNorm ?? r?.category_norm ?? r?.tab ?? r?.type ?? r?.kind
  );

  const imageUrl = String(
    r?.imageUrl ?? r?.image_url ?? r?.image ?? r?.thumbnail ?? r?.thumb ?? ""
  ).trim();

  const lat =
    typeof r?.lat === "number"
      ? r.lat
      : typeof r?.latitude === "number"
      ? r.latitude
      : typeof r?.lat === "string"
      ? Number(r.lat)
      : typeof r?.latitude === "string"
      ? Number(r.latitude)
      : null;

  const lng =
    typeof r?.lng === "number"
      ? r.lng
      : typeof r?.longitude === "number"
      ? r.longitude
      : typeof r?.lng === "string"
      ? Number(r.lng)
      : typeof r?.longitude === "string"
      ? Number(r.longitude)
      : null;

  const safeLat = Number.isFinite(lat as any) ? (lat as number) : null;
  const safeLng = Number.isFinite(lng as any) ? (lng as number) : null;

  const distanceKm =
    typeof r?.distanceKm === "number"
      ? r.distanceKm
      : typeof r?.distance_km === "number"
      ? r.distance_km
      : typeof r?.distance === "number"
      ? r.distance / 1000
      : 0;

  return {
    id,
    name,
    category, // ✅ HomeCard 필수
    categoryLabel: String(r?.categoryLabel ?? r?.category_label ?? labelOfCategory(category)),
    distanceKm: Number.isFinite(distanceKm) ? distanceKm : 0,
    moodText: String(r?.moodText ?? r?.mood_text ?? r?.mood ?? ""),
    imageUrl,

    lat: safeLat,
    lng: safeLng,
    mood: r?.mood ?? null,
    withKids: r?.withKids ?? r?.with_kids ?? null,
    forWork: r?.forWork ?? r?.for_work ?? null,
    priceLevel: r?.priceLevel ?? r?.price_level ?? null,
    tags: r?.tags ?? null,
  };
}

// ===============================
// API fetchers
// ===============================
async function safeReadJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * 홈 추천 API (/api/home-recommend)
 * - all: 기본 12장
 * - category: 기본 5장
 */
export async function fetchHomeCardsByTab(
  tab: HomeTabKey,
  options?: { count?: number }
): Promise<HomeCard[]> {
  const t = normalizeTab(tab);
  const count = options?.count ?? (t === "all" ? 12 : 5);

  const res = await fetch(
    `/api/home-recommend?tab=${encodeURIComponent(t)}&count=${count}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    const j = await safeReadJson(res);
    const detail = j?.detail ? ` (${j.detail})` : "";
    throw new Error(`failed to fetch home cards: ${res.status}${detail}`);
  }

  const json = await safeReadJson(res);
  const items = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
  return items.map(toHomeCard);
}

/**
 * 기존 코드 호환용 (RecommendSection 등)
 */
export async function fetchStores(): Promise<HomeCard[]> {
  return fetchHomeCardsByTab("all", { count: 12 });
}

/**
 * 근처 카드 (있는 경우만 사용)
 * - useNearbyCards와 동일 엔드포인트
 */
export async function fetchNearbyCards(params: {
  tab: HomeTabKey;
  lat: number;
  lng: number;
  radius?: number;
  limit?: number;
}): Promise<HomeCard[]> {
  const radius = params.radius ?? 2000;
  const limit = params.limit ?? 12;

  const qs = new URLSearchParams();
  qs.set("lat", String(params.lat));
  qs.set("lng", String(params.lng));
  qs.set("radius", String(radius));
  qs.set("tab", normalizeTab(params.tab));
  qs.set("limit", String(limit));

  const res = await fetch(`/api/local/nearby?${qs.toString()}`, { cache: "no-store" });
  if (!res.ok) return [];

  const json = await safeReadJson(res);
  const items = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
  return items.map(toHomeCard);
}
