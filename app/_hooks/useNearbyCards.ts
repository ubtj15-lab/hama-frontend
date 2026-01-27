"use client";

import { useEffect, useRef, useState } from "react";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { fetchNearbyStores } from "@/lib/storeRepository";
import { logEvent } from "@/lib/logEvent";

type Loc = { lat: number; lng: number } | null;

export function useNearbyCards(homeTab: HomeTabKey, loc: Loc) {
  const [cards, setCards] = useState<HomeCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 탭/위치 바뀔 때 레이스 방지
  const reqIdRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const reqId = ++reqIdRef.current;

    // 위치가 없으면(권한 거부/로딩 전) 근처카드 불가
    if (!loc) {
      setCards([]);
      setIsLoading(false);
      return () => {
        alive = false;
      };
    }

    setIsLoading(true);

    (async () => {
      try {
        const next = await fetchNearbyStores({
          lat: loc.lat,
          lng: loc.lng,
          tab: homeTab,
          radiusKm: 4, // 필요하면 2~8로 조절
          limit: homeTab === "all" ? 12 : 8,
        });

        if (!alive) return;
        if (reqId !== reqIdRef.current) return;

        const safe = Array.isArray(next) ? next : [];
        setCards(safe);

        logEvent("nearby_loaded", {
          tab: homeTab,
          count: safe.length,
          lat: loc.lat,
          lng: loc.lng,
        });
      } catch (e) {
        if (!alive) return;
        if (reqId !== reqIdRef.current) return;

        console.error("[useNearbyCards] failed:", e);
        setCards([]);
      } finally {
        if (!alive) return;
        if (reqId !== reqIdRef.current) return;

        setIsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [homeTab, loc?.lat, loc?.lng]);

  return { cards, isLoading };
}
