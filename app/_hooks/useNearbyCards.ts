"use client";

import { useEffect, useState } from "react";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";

type LatLng = { lat: number; lng: number } | null | undefined;

type Result = {
  cards: HomeCard[];
  isLoading: boolean;
};

const PER_CATEGORY = 5;
const POOL_SIZE = 40; // ✅ 후보풀 (API에서 이만큼 보장하도록 시도)

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

async function fetchNearbyPoolFromApi(params: {
  lat: number;
  lng: number;
  tab: Exclude<HomeTabKey, "all">;
  radiusKm?: number;
  limit?: number;
}): Promise<HomeCard[]> {
  const url = new URL("/api/places/nearby", window.location.origin);
  url.searchParams.set("lat", String(params.lat));
  url.searchParams.set("lng", String(params.lng));
  url.searchParams.set("tab", params.tab);
  url.searchParams.set("radiusKm", String(params.radiusKm ?? 4));
  url.searchParams.set("limit", String(params.limit ?? POOL_SIZE));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];

  const json = await res.json();
  if (!json?.ok) return [];

  return Array.isArray(json.cards) ? (json.cards as HomeCard[]) : [];
}

async function fetchNearbyCategoryRandom(
  loc: { lat: number; lng: number },
  tab: Exclude<HomeTabKey, "all">
): Promise<HomeCard[]> {
  const pool = await fetchNearbyPoolFromApi({ lat: loc.lat, lng: loc.lng, tab, limit: POOL_SIZE });
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
