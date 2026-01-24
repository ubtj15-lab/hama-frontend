"use client";

import { useEffect, useRef, useState } from "react";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { toHomeCard } from "@/lib/storeRepository";

type Loc = { lat: number; lng: number } | null;

export function useNearbyCards(tab: HomeTabKey, loc: Loc, radius = 2000) {
  const [cards, setCards] = useState<HomeCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reqIdRef = useRef(0);

  useEffect(() => {
  let alive = true;
  const reqId = ++reqIdRef.current;

  if (!loc) {
    setIsLoading(false);
    return () => {
      alive = false;
    };
  }

  const { lat, lng } = loc; // ✅ 여기서 null 아님이 보장됨

  setIsLoading(true);

  async function load() {
    try {
      const qs = new URLSearchParams();
      qs.set("lat", String(lat));
      qs.set("lng", String(lng));
      qs.set("radius", String(radius));
      qs.set("tab", String(tab));
      qs.set("limit", "12");

      const res = await fetch(`/api/local/nearby?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!alive) return;
      if (reqId !== reqIdRef.current) return;

      const raw = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json)
        ? json
        : [];

      setCards(raw.map(toHomeCard));
    } finally {
      if (!alive) return;
      if (reqId !== reqIdRef.current) return;
      setIsLoading(false);
    }
  }

  load();

  return () => {
    alive = false;
  };
}, [tab, loc?.lat, loc?.lng, radius]);

  return { cards, isLoading };
}
