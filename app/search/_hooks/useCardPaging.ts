"use client";

import { useMemo } from "react";
import type { CardInfo, Category } from "./useSearchStores";
import { normalizeCategory } from "./useSearchStores";

type Args = {
  stores: CardInfo[];
  activeCategory: Category | null;
  query: string;
  hasMyLocation: boolean;
  myLat: number;
  myLng: number;

  exploreMode?: boolean;
  radiusKm?: number;
};

type Result = {
  categoryStores: CardInfo[];
  pages: CardInfo[][];
  usedFallbackFar?: boolean;
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

/**
 * ✅ 자연어 query에서 “의미 키워드만” 뽑기
 * - 구두점/슬래시/공백 기준 토큰화
 * - 불용어 제거(근처, 추천, 찾아줘, 뭐, 먹지 등)
 * - 남은 키워드가 없으면 [] (=> 검색 필터 안 걸림)
 */
function extractKeywords(rawQuery: string, activeCategory: Category | null): string[] {
  const raw = String(rawQuery ?? "").toLowerCase().trim();
  if (!raw) return [];

  // 카테고리 단어만 들어온 경우는 키워드로 보지 않음
  const categoryWords = new Set(
    ["카페", "cafe", "식당", "restaurant", "미용", "미용실", "beauty", "salon", "활동", "액티비티", "activity"]
      .map((x) => normText(x))
  );

  const only = normText(raw);
  if (categoryWords.has(only)) return [];

  // 토큰화(공백/구두점/슬래시/특수문자 기준)
  const tokens = raw
    .split(/[\s/|,.;:!?()\[\]{}"'`~@#$%^&*+=<>\\_-]+/g)
    .map((t) => t.trim())
    .filter(Boolean);

  // 불용어(자연어에서 거의 의미 없는 단어들)
  const stop = new Set([
    "근처",
    "가까운",
    "가까이",
    "찾아줘",
    "찾아",
    "추천",
    "알려줘",
    "뭐",
    "먹지",
    "먹을까",
    "점심",
    "저녁",
    "아침",
    "오늘",
    "내일",
    "요즘",
    "해줘",
    "해",
    "좀",
    "아",
    "그",
    "이",
    "저",
  ]);

  // 카테고리와 중복되는 키워드 제거(“카페”를 이미 탭으로 골랐으면 키워드에서 빼기)
  const categoryStop = new Set<string>();
  if (activeCategory === "cafe") categoryStop.add("카페");
  if (activeCategory === "restaurant") categoryStop.add("식당");
  if (activeCategory === "salon") categoryStop.add("미용실");
  if (activeCategory === "activity") categoryStop.add("액티비티");

  const keywords = tokens
    .filter((t) => !stop.has(t))
    .filter((t) => !categoryStop.has(t))
    .map((t) => normText(t))
    .filter((t) => t.length >= 2); // 너무 짧은 건 제거

  // 중복 제거
  return Array.from(new Set(keywords));
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
  const {
    stores,
    activeCategory,
    query,
    hasMyLocation,
    myLat,
    myLng,
    exploreMode = true,
    radiusKm = 3,
  } = args;

  return useMemo(() => {
    const keywords = extractKeywords(query, activeCategory);

    // 1) normalize + distance
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

    // 2) 카테고리 스코프(있을 때만)
    let scoped: NormalizedCard[] = normalized;
    if (activeCategory) {
      scoped = scoped.filter((s) => s.category === activeCategory);
    }

    // 3) 키워드 검색(자연어는 키워드가 없으면 필터 자체를 안 건다)
    scoped = scoped.filter((s) => {
      if (!keywords.length) return true;

      const name = normText((s as any).name ?? "");
      const addr = normText((s as any).address ?? "");
      const mood = normText((s as any).mood ?? "");

      const tagsRaw = (s as any).tags;
      const tags = Array.isArray(tagsRaw)
        ? normText(tagsRaw.join(" "))
        : normText(tagsRaw ?? "");

      // ✅ 키워드 중 하나라도 포함되면 통과
      return keywords.some((k) => name.includes(k) || addr.includes(k) || mood.includes(k) || tags.includes(k));
    });

    // 4) 거리 정렬(가능할 때만)
    if (hasMyLocation) {
      scoped = scoped.sort((a, b) => {
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return da - db;
      });
    }

    // 5) 근처 탐색 반경 + fallback
    let usedFallbackFar = false;

    if (exploreMode && hasMyLocation) {
      const nearby = scoped.filter((s) => (s.distanceKm ?? Number.POSITIVE_INFINITY) <= radiusKm);

      if (nearby.length > 0) {
        scoped = nearby;
      } else {
        // ✅ 근처 0개면 “가까운 순 상위”로라도 유지
        usedFallbackFar = true;
        scoped = scoped.slice(0, 200);
      }
    }

    const categoryStores: CardInfo[] = scoped;

    const pages: CardInfo[][] = [
      categoryStores.slice(0, 3),
      categoryStores.slice(3, 6),
      categoryStores.slice(6, 9),
    ];

    return { categoryStores, pages, usedFallbackFar };
  }, [stores, activeCategory, query, hasMyLocation, myLat, myLng, exploreMode, radiusKm]);
}
