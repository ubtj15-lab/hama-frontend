"use client";

import { useMemo } from "react";
import type { CardInfo, Category } from "./useSearchStores";
import { normalizeCategory } from "./useSearchStores";

type Args = {
  stores: CardInfo[];
  activeCategory: Category;
  query: string;
  hasMyLocation: boolean;
  myLat: number;
  myLng: number;
};

type Result = {
  categoryStores: CardInfo[];
  pages: CardInfo[][];
};

function normText(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function toNumberOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
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

function effectiveQuery(rawQuery: string, activeCategory: Category): string {
  const q = normText(rawQuery);
  if (!q) return "";

  const categoryWords = new Set(
    [
      "카페",
      "cafe",
      "식당",
      "restaurant",
      "미용",
      "미용실",
      "beauty",
      "salon",
      "활동",
      "액티비티",
      "activity",
    ].map(normText)
  );

  if (categoryWords.has(q)) return "";

  if (activeCategory === "cafe" && (q === normText("카페") || q === "cafe"))
    return "";
  if (
    activeCategory === "restaurant" &&
    (q === normText("식당") || q === "restaurant")
  )
    return "";
  if (
    activeCategory === "salon" &&
    (q === normText("미용실") || q === "beauty" || q === "salon")
  )
    return "";
  if (
    activeCategory === "activity" &&
    (q === normText("활동") || q === normText("액티비티") || q === "activity")
  )
    return "";

  return q;
}

type NormalizedCard = CardInfo & {
  id: string;
  name: string;
  category: Category;
  lat: number | null;
  lng: number | null;
  distanceKm?: number | null;
};

export function useCardPaging(args: Args): Result {
  const { stores, activeCategory, query, hasMyLocation, myLat, myLng } = args;

  return useMemo(() => {
    const q = effectiveQuery(query, activeCategory);

    const normalized: NormalizedCard[] = (stores ?? [])
      .map((s) => {
        const categoryNorm = normalizeCategory((s as any).category);
        if (!categoryNorm) return null;

        const lat = toNumberOrNull((s as any).lat);
        const lng = toNumberOrNull((s as any).lng);

        let d: number | null = null;
        if (hasMyLocation && lat != null && lng != null) {
          d = distanceKm(myLat, myLng, lat, lng);
        }

        const name = String((s as any).name ?? "").trim();
        if (!name) return null;

        return {
          ...(s as any),
          id: String((s as any).id ?? ""),
          name,
          category: categoryNorm,
          lat,
          lng,
          distanceKm: d,
        } as NormalizedCard;
      })
      .filter((v): v is NormalizedCard => v !== null);

    const categoryStores: CardInfo[] = normalized
      .filter((s) => s.category === activeCategory)
      .filter((s) => {
        if (!q) return true;

        const name = normText((s as any).name ?? "");
        const addr = normText((s as any).address ?? "");
        const mood = normText((s as any).mood ?? "");

        const tagsRaw = (s as any).tags;
        const tags = Array.isArray(tagsRaw)
          ? normText(tagsRaw.join(" "))
          : normText(tagsRaw ?? "");

        return (
          name.includes(q) ||
          addr.includes(q) ||
          mood.includes(q) ||
          tags.includes(q)
        );
      })
      .sort((a: any, b: any) => {
        if (!hasMyLocation) return 0;
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return da - db;
      });

    const pages: CardInfo[][] = [
      categoryStores.slice(0, 3),
      categoryStores.slice(3, 6),
      categoryStores.slice(6, 9),
    ];

    return { categoryStores, pages };
  }, [stores, activeCategory, query, hasMyLocation, myLat, myLng]);
}
