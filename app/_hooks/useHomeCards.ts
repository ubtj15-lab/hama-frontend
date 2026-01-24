"use client";

import { useEffect, useRef, useState } from "react";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { fetchHomeCardsByTab } from "@/lib/storeRepository";
import { logEvent } from "@/lib/logEvent";

export function useHomeCards(homeTab: HomeTabKey) {
  const [cards, setCards] = useState<HomeCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reqIdRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const reqId = ++reqIdRef.current;

    setIsLoading(true);

    async function load() {
      try {
        const next =
          homeTab === "all"
            ? await fetchHomeCardsByTab("all", { count: 12 })
            : await fetchHomeCardsByTab(homeTab, { count: 5 });

        if (!alive) return;
        if (reqId !== reqIdRef.current) return;

        const safe = Array.isArray(next) ? next : [];
        setCards(safe);
        logEvent("home_tab_loaded", { tab: homeTab, count: safe.length });
      } catch (e) {
        if (!alive) return;
        if (reqId !== reqIdRef.current) return;

        console.error("[useHomeCards] failed:", e);
        setCards([]);
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
  }, [homeTab]);

  return { cards, isLoading };
}
