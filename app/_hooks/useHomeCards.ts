// app/_hooks/useHomeCards.ts
"use client";

import { useEffect, useState } from "react";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { fetchHomeCardsByTab } from "@/lib/storeRepository";

type Result = {
  cards: HomeCard[];
  isLoading: boolean;
};

const PER_CATEGORY = 5;     // ✅ 최종 노출 개수
const POOL_SIZE = 40;       // ✅ 후보 풀(이 안에서 랜덤으로 5개 뽑음)

function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandomN<T>(array: T[], n: number): T[] {
  if (!Array.isArray(array) || array.length === 0) return [];
  return shuffle(array).slice(0, Math.min(n, array.length));
}

async function fetchCategoryRandom(tab: Exclude<HomeTabKey, "all">): Promise<HomeCard[]> {
  // ✅ 고정 TOP 5가 아니라, 넉넉히 가져와서(POOL_SIZE) 랜덤 5개만 뽑기
  const pool = await fetchHomeCardsByTab(tab, { count: POOL_SIZE });
  return pickRandomN(pool, PER_CATEGORY);
}

async function fetchAllMixedRecommend(): Promise<HomeCard[]> {
  const [restaurants, cafes, salons, activities] = await Promise.all([
    fetchCategoryRandom("restaurant"),
    fetchCategoryRandom("cafe"),
    fetchCategoryRandom("salon"),
    fetchCategoryRandom("activity"),
  ]);

  // ✅ 구성 유지(각 5개) + 카테고리 블록 순서도 살짝 섞고 싶으면 shuffle로 감싸도 됨
  return [...restaurants, ...cafes, ...salons, ...activities];
}

export function useHomeCards(tab: HomeTabKey, shuffleKey: number): Result {
  const [cards, setCards] = useState<HomeCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      try {
        const result =
          tab === "all"
            ? await fetchAllMixedRecommend()
            : await fetchCategoryRandom(tab as Exclude<HomeTabKey, "all">);

        if (!cancelled) setCards(result);
      } catch (e) {
        console.error("[useHomeCards]", e);
        if (!cancelled) setCards([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [tab, shuffleKey]);

  return { cards, isLoading };
}
