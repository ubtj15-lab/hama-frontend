"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export type Category = "cafe" | "restaurant" | "salon" | "activity";

export type Store = {
  id: string;
  name: string;

  // DB raw
  category: string;

  // app normalized
  categoryNorm: Category;

  area: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;

  phone: string | null;
  kakao_place_url: string | null;
  source: string | null;

  // DB is ARRAY (per your schema)
  mood: string[] | null;
  tags: string[] | null;

  // DB is text (per your schema)
  price_level: string | null;

  with_kids: boolean | null;
  for_work: boolean | null;
  reservation_required: boolean | null;

  // stores table doesn't have it, keep for UI fallback flow
  image_url: string | null;
};

export type CardInfo = Store & { distanceKm?: number | null };

function toNumberOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStringArrayOrNull(v: unknown): string[] | null {
  if (Array.isArray(v)) return v.map((x) => String(x ?? "")).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return null;
}

// DB category 정규화: CE7/FD6/BK9 + 영문/한글 + beauty/salon 호환
export function normalizeCategory(raw: unknown): Category | null {
  const c0 = String(raw ?? "").trim();
  const c = c0.toLowerCase();

  // canonical
  if (c === "cafe" || c === "restaurant" || c === "salon" || c === "activity") {
    return c as Category;
  }

  // legacy/compat
  if (c === "beauty") return "salon";

  // kakao codes
  if (c0 === "CE7") return "cafe";
  if (c0 === "FD6") return "restaurant";
  if (c0 === "BK9") return "salon";

  // korean labels
  if (c0 === "카페") return "cafe";
  if (c0 === "식당") return "restaurant";
  if (c0 === "미용실") return "salon";
  if (c0 === "액티비티" || c0 === "활동" || c0 === "공원" || c0 === "박물관") {
    return "activity";
  }

  return null;
}

// URL category 파라미터를 내부 Category로
export function mapUrlCategoryToCategory(c: string | null): Category | null {
  if (!c) return null;
  const t = String(c).trim();
  const tl = t.toLowerCase();

  if (tl === "cafe" || tl === "restaurant" || tl === "salon" || tl === "activity") {
    return tl as Category;
  }

  if (t === "CE7") return "cafe";
  if (t === "FD6") return "restaurant";
  if (t === "BK9") return "salon";

  if (tl === "beauty") return "salon";
  return null;
}

// 검색어로 카테고리 추론 (category param 없을 때)
export function inferCategoryFromQuery(q: string): Category {
  const t = String(q ?? "").toLowerCase();

  if (
    t.includes("미용") ||
    t.includes("헤어") ||
    t.includes("뷰티") ||
    t.includes("살롱") ||
    t.includes("salon") ||
    t.includes("beauty")
  ) {
    return "salon";
  }

  if (
    t.includes("식당") ||
    t.includes("밥") ||
    t.includes("한식") ||
    t.includes("레스토랑") ||
    t.includes("맛집")
  ) {
    return "restaurant";
  }

  if (
    t.includes("박물관") ||
    t.includes("공원") ||
    t.includes("체험") ||
    t.includes("활동") ||
    t.includes("놀") ||
    t.includes("키즈")
  ) {
    return "activity";
  }

  return "cafe";
}

export function useSearchStores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("stores")
        .select(
          "id,name,category,area,address,lat,lng,phone,kakao_place_url,source,mood,with_kids,for_work,price_level,tags,reservation_required"
        )
        .limit(5000);

      if (!alive) return;

      if (error) {
        console.error("Supabase stores fetch error:", error);
        setStores([]);
        setLoading(false);
        return;
      }

      const cleaned: Store[] = (data ?? [])
        .map((s: any) => {
          const catNorm = normalizeCategory(s.category);
          if (!catNorm) return null;

          const name = String(s.name ?? "").trim();
          if (!name) return null;

          return {
            id: String(s.id),
            name,
            category: String(s.category ?? ""),
            categoryNorm: catNorm,

            area: s.area ?? null,
            address: s.address ?? null,
            lat: toNumberOrNull(s.lat),
            lng: toNumberOrNull(s.lng),

            phone: s.phone ?? null,
            kakao_place_url: s.kakao_place_url ?? null,
            source: s.source ?? null,

            mood: toStringArrayOrNull(s.mood),
            tags: toStringArrayOrNull(s.tags),

            price_level: s.price_level ?? null,

            with_kids: s.with_kids ?? null,
            for_work: s.for_work ?? null,
            reservation_required: s.reservation_required ?? null,

            image_url: null,
          };
        })
        .filter(Boolean) as Store[];

      setStores(cleaned);
      setLoading(false);
    };

    run();
    return () => {
      alive = false;
    };
  }, []);

  return { stores, loading };
}
