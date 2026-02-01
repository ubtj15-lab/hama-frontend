// app/_hooks/useNearbyCards.ts
"use client";

import { useEffect, useState } from "react";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { fetchNearbyStores } from "@/lib/storeRepository";

type LatLng = { lat: number; lng: number } | null | undefined;

type Result = {
  cards: HomeCard[];
  isLoading: boolean;
};

const PER_CATEGORY = 5;     // ✅ 최종 노출 개수
const POOL_SIZE = 40;       // ✅ 후보 풀

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

async function fetchNearbyCategoryRandom(
  loc: { lat: number; lng: number },
  tab: Exclude<HomeTabKey, "all">
): Promise<HomeCard[]> {
  // ✅ 근처도 POOL_SIZE만큼 후보를 받고 그 안에서 랜덤 5개
  const pool = await fetchNearbyStores({
    lat: loc.lat,
    lng: loc.lng,
    tab,
    limit: POOL_SIZE,
  });
  return pickRandomN(pool, PER_CATEGORY);
}

async function fetchAllMixedNearby(loc: { lat: number; lng: number }): Promise<HomeCard[]> {
  const [restaurants, cafes, salons, activities] = await Promise.all([
    fetchNearbyCategoryRandom(loc, "restaurant"),
    fetchNearbyCategoryRandom(loc, "cafe"),
    fetchNearbyCategoryRandom(loc, "salon"),
    fetchNearbyCategoryRandom(loc, "activity"),
  ]);

  return [...restaurants, ...cafes, ...salons, ...activities];
}

export function useNearbyCards(tab: HomeTabKey, loc: LatLng, shuffleKey: number): Result {
  const [cards, setCards] = useState<HomeCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!loc?.lat || !loc?.lng) {
        setCards([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result =
          tab === "all"
            ? await fetchAllMixedNearby({ lat: loc.lat, lng: loc.lng })
            : await fetchNearbyCategoryRandom(
                { lat: loc.lat, lng: loc.lng },
                tab as Exclude<HomeTabKey, "all">
              );

        if (!cancelled) setCards(result);
      } catch (e) {
        console.error("[useNearbyCards]", e);
        if (!cancelled) setCards([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [tab, loc?.lat, loc?.lng, shuffleKey]);

  return { cards, isLoading };
}
