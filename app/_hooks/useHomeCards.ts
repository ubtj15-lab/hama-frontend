"use client";

import { useEffect, useState } from "react";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { fetchHomeCardsByTab } from "@lib/storeRepository";
import { logEvent } from "@/lib/logEvent";

export function useHomeCards(homeTab: HomeTabKey) {
  const [cards, setCards] = useState<HomeCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      setIsLoading(true);
      try {
        let next: HomeCard[] = [];

        if (homeTab === "all") {
          const all = (await fetchHomeCardsByTab("all")) ?? [];

          const getKey = (c: any) =>
            (
              c?.tab ??
              c?.homeTab ??
              c?.type ??
              c?.categoryKey ??
              c?.category ??
              c?.categoryCode ??
              c?.categoryLabel ??
              ""
            )
              .toString()
              .toLowerCase();

          const restaurants = all.filter((c: any) => {
            const k = getKey(c);
            return k === "restaurant" || k === "food" || k === "fd6";
          });

          const cafes = all.filter((c: any) => {
            const k = getKey(c);
            return k === "cafe" || k === "ce7";
          });

          const beauty = all.filter((c: any) => {
            const k = getKey(c);
            return k === "salon" || k === "beauty" || k === "bk9";
          });

          const activity = all.filter((c: any) => {
            const k = getKey(c);
            return k === "activity" || k === "at4";
          });

          const takeN = (arr: HomeCard[], n: number) => {
            const out: HomeCard[] = [];
            const seen = new Set<string>();
            for (const item of arr) {
              const id = String((item as any).id ?? "");
              if (!id) continue;
              if (seen.has(id)) continue;
              out.push(item);
              seen.add(id);
              if (out.length >= n) break;
            }
            return out;
          };

          const q1 = takeN(restaurants as any, 4);
          const q2 = takeN(cafes as any, 4);
          const q3 = takeN(beauty as any, 2);
          const q4 = takeN(activity as any, 2);

          const picked: HomeCard[] = [];
          const pickedSet = new Set<string>();
          for (const x of [...q1, ...q2, ...q3, ...q4]) {
            const id = String((x as any).id ?? "");
            if (!id) continue;
            if (pickedSet.has(id)) continue;
            picked.push(x);
            pickedSet.add(id);
          }

          if (picked.length < 12) {
            for (const item of all as any) {
              const id = String(item?.id ?? "");
              if (!id) continue;
              if (pickedSet.has(id)) continue;
              picked.push(item);
              pickedSet.add(id);
              if (picked.length >= 12) break;
            }
          }

          next = picked.slice(0, 12);
        } else {
          next = (await fetchHomeCardsByTab(homeTab, { count: 5 })) ?? [];
          next = next.slice(0, 5);
        }

        if (!alive) return;

        setCards(next);
        logEvent("home_tab_loaded", { tab: homeTab, count: next.length });
      } catch {
        if (!alive) return;
        setCards([]);
      } finally {
        if (!alive) return;
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
