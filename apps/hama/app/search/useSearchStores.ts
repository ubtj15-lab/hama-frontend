"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@hama/shared";
import type { StoreRecord } from "@lib/storeTypes";


export type StoreCategory = "cafe" | "restaurant" | "salon" | "activity";

export type Store = {
  id: string;
  name: string;
  category: StoreCategory; // 정규화된 카테고리만 들어오게 처리
  address: string | null;
  lat: number | null;
  lng: number | null;

  mood: string | null;
  with_kids: boolean | null;
  for_work: boolean | null;
  price_level: number | null;
  tags: string[] | string | null;

  image_url: string | null;
  is_active: boolean | null;
};

export type CardInfo = Store & { distanceKm: number | null };

function toNumberOrNull(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normText(v: any): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** DB/URL/한글/카카오코드 등 섞여도 하나로 정규화 */
export function normalizeCategory(raw: any): StoreCategory | null {
  const c = normText(raw);

  // 이미 내부값
  if (c === "cafe" || c === "restaurant" || c === "salon" || c === "activity")
    return c;

  // 예전 코드/값들
  if (c === "beauty") return "salon"; // 네가 예전 beauty 썼던 거 흡수
  if (c === "bk9") return "salon";
  if (c === "ce7") return "cafe";
  if (c === "fd6") return "restaurant";

  // 한글
  if (c.includes("카페")) return "cafe";
  if (c.includes("식당") || c.includes("음식")) return "restaurant";
  if (c.includes("미용") || c.includes("헤어") || c.includes("살롱"))
    return "salon";
  if (c.includes("액티") || c.includes("활동") || c.includes("공원") || c.includes("박물관"))
    return "activity";

  // 기타 매핑 필요하면 여기 추가
  return null;
}

export function mapUrlCategoryToStoreCategory(
  c: string | null
): StoreCategory | null {
  if (!c) return null;
  return normalizeCategory(c);
}

export function inferCategoryFromQuery(q: string): StoreCategory {
  const t = normText(q);

  if (t.includes("미용") || t.includes("헤어") || t.includes("살롱") || t.includes("뷰티"))
    return "salon";

  if (t.includes("식당") || t.includes("밥") || t.includes("한식") || t.includes("맛집") || t.includes("레스토랑"))
    return "restaurant";

  if (t.includes("박물관") || t.includes("공원") || t.includes("체험") || t.includes("활동") || t.includes("키즈") || t.includes("놀"))
    return "activity";

  // 기본은 카페
  return "cafe";
}

/** Haversine */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function fallbackImageByCategory(category: StoreCategory) {
  if (category === "restaurant") return "/images/fallback/restaurant.jpg";
  if (category === "cafe") return "/images/fallback/cafe.jpg";
  if (category === "salon") return "/images/fallback/beauty.jpg";
  return "/images/fallback/activity.jpg";
}

type UseSearchStoresArgs = {
  query: string;
  rawCategory: string | null;
  myLat: number | null;
  myLng: number | null;
  limit?: number; // 가져올 최대 rows
};

export function useSearchStores({
  query,
  rawCategory,
  myLat,
  myLng,
  limit = 2000,
}: UseSearchStoresArgs) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  const hasMyLocation =
    typeof myLat === "number" &&
    Number.isFinite(myLat) &&
    typeof myLng === "number" &&
    Number.isFinite(myLng);

  const activeCategory: StoreCategory = useMemo(() => {
    const byParam = mapUrlCategoryToStoreCategory(rawCategory);
    if (byParam) return byParam;
    return inferCategoryFromQuery(query);
  }, [rawCategory, query]);

  // ✅ 여기서 "카페" 같은 검색어는 카테고리에서 이미 걸러지니까,
  // 검색필터에는 오히려 방해될 수 있음 → 제거용 키워드 세트
  const effectiveQuery = useMemo(() => {
    const q = normText(query);
    if (!q) return "";
    const block = new Set(["카페", "식당", "맛집", "미용실", "헤어", "살롱", "활동", "액티비티", "데이트", "코스"]);
    if (block.has(q)) return "";
    return q;
  }, [query]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("stores")
        .select(
          "id,name,category,lat,lng,address,mood,with_kids,for_work,price_level,tags,image_url,is_active"
        )
        .eq("is_active", true)
        .limit(limit);

      if (!alive) return;

      if (error) {
        console.error("Supabase stores fetch error:", error);
        setStores([]);
        setLoading(false);
        return;
      }

      const cleaned: Store[] = (data ?? [])
        .map((s: any) => {
          const cat = normalizeCategory(s.category);
          return {
            id: String(s.id),
            name: String(s.name ?? "").trim(),
            category: (cat ?? "cafe") as any, // 임시
            address: s.address ?? null,
            lat: toNumberOrNull(s.lat),
            lng: toNumberOrNull(s.lng),
            mood: s.mood ?? null,
            with_kids: s.with_kids ?? null,
            for_work: s.for_work ?? null,
            price_level: s.price_level ?? null,
            tags: s.tags ?? null,
            image_url: s.image_url ?? null,
            is_active: s.is_active ?? null,
          } as Store;
        })
        .filter((s: Store) => !!s.name && normalizeCategory(s.category) != null)
        .map((s: Store) => ({
          ...s,
          category: normalizeCategory(s.category)!,
        }));

      setStores(cleaned);
      setLoading(false);
    };

    run();

    return () => {
      alive = false;
    };
  }, [limit]);

  const categoryStores: CardInfo[] = useMemo(() => {
    const qKey = effectiveQuery;

    const filtered = stores
      .filter((s) => s.category === activeCategory)
      .filter((s) => {
        if (!qKey) return true;
        const name = normText(s.name);
        const addr = normText(s.address ?? "");
        const mood = normText(s.mood ?? "");
        const tags = Array.isArray(s.tags) ? normText(s.tags.join(" ")) : normText(s.tags ?? "");
        return (
          name.includes(qKey) ||
          addr.includes(qKey) ||
          mood.includes(qKey) ||
          tags.includes(qKey)
        );
      })
      .map((s) => {
        if (
          hasMyLocation &&
          typeof s.lat === "number" &&
          typeof s.lng === "number"
        ) {
          return { ...s, distanceKm: distanceKm(myLat!, myLng!, s.lat, s.lng) };
        }
        return { ...s, distanceKm: null };
      })
      .sort((a, b) => {
        if (!hasMyLocation) return 0;
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return da - db;
      });

    return filtered;
  }, [stores, activeCategory, effectiveQuery, hasMyLocation, myLat, myLng]);

  const pages: CardInfo[][] = useMemo(() => {
    // ✅ 원하는 구조: 한 페이지에 3개(큰1 + 작은2)
    return [categoryStores.slice(0, 3), categoryStores.slice(3, 6), categoryStores.slice(6, 9)];
  }, [categoryStores]);

  return {
    loading,
    activeCategory,
    hasMyLocation,
    categoryStores,
    pages,
  };
}

export function labelOfCategory(category: StoreCategory): string {
  if (category === "cafe") return "카페";
  if (category === "restaurant") return "식당";
  if (category === "salon") return "미용실";
  return "활동";
}

export function getDetailButtonLabel(category: StoreCategory): string {
  if (category === "salon") return "시술";
  if (category === "cafe" || category === "restaurant") return "메뉴";
  return "정보";
}
