// app/lib/storeRepository.ts
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";

// 카테고리 라벨
function labelOfCategory(cat: string): string {
  const c = (cat || "").toLowerCase().trim();
  if (c === "restaurant") return "식당";
  if (c === "cafe") return "카페";
  if (c === "salon" || c === "beauty") return "미용실";
  if (c === "activity") return "액티비티";
  return "장소";
}

// ✅ nearBy/추천/혼합 응답 다 받는 매퍼
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

  const categoryRaw =
    r?.category ??
    r?.categoryNorm ??
    r?.category_norm ??
    r?.tab ??
    r?.type ??
    r?.kind ??
    "";

  const category = String(categoryRaw).toLowerCase().trim();

  const imageUrl = (r?.imageUrl ??
    r?.image_url ??
    r?.image ??
    r?.thumbnail ??
    r?.thumb ??
    "") as string;

  const lat =
    typeof r?.lat === "number"
      ? r.lat
      : typeof r?.latitude === "number"
      ? r.latitude
      : r?.lat ?? null;

  const lng =
    typeof r?.lng === "number"
      ? r.lng
      : typeof r?.longitude === "number"
      ? r.longitude
      : r?.lng ?? null;

 return {
  id,
  name,

  // ✅ 핵심 추가
  category,

  categoryLabel: String(
    r?.categoryLabel ??
    r?.category_label ??
    labelOfCategory(category)
  ),

  distanceKm:
    typeof r?.distanceKm === "number"
      ? r.distanceKm
      : typeof r?.distance_km === "number"
      ? r.distance_km
      : 0,

  moodText: String(r?.moodText ?? r?.mood_text ?? r?.mood ?? ""),

  imageUrl: String(imageUrl || ""),

  lat,
  lng,

  mood: r?.mood ?? null,
  withKids: r?.withKids ?? r?.with_kids ?? null,
  forWork: r?.forWork ?? r?.for_work ?? null,
  priceLevel: r?.priceLevel ?? r?.price_level ?? null,
  tags: r?.tags ?? null,
};

}

type FetchOptions = { count?: number };

// ✅ 핵심:
// 1) tab/count를 query로 보냄
// 2) 응답 {items: []}를 읽음
// 3) _ts 붙여서 새로고침/탭 변경마다 캐시 재사용 방지 (랜덤 추천에 필수)
export async function fetchHomeCardsByTab(
  homeTab: HomeTabKey | string,
  opts?: FetchOptions
): Promise<HomeCard[]> {
  const tab = String(homeTab || "all").toLowerCase().trim();
  const count = opts?.count ?? (tab === "all" ? 12 : 5);

  const ts = Date.now(); // ✅ cache-bust
  const url = `/api/home-recommend?tab=${encodeURIComponent(tab)}&count=${encodeURIComponent(
    String(count)
  )}&_ts=${ts}`;

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[fetchHomeCardsByTab] failed:", res.status, text);
    return [];
  }

  const json = await res.json().catch(() => null);

  const rawItems: any[] = Array.isArray(json)
    ? json
    : Array.isArray(json?.items)
    ? json.items
    : [];

  const mapped = rawItems
    .map(toHomeCard)
    .filter((c: HomeCard) => Boolean(c.id && c.name));

  return mapped;
}
