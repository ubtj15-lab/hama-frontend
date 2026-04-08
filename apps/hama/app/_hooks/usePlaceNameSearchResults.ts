"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { HomeCard } from "@/lib/storeTypes";
import { toHomeCard, type StoreRow as RepoStoreRow } from "@/lib/storeRepository";
import { attachDistanceToCard } from "@/lib/results/attachDistanceToCard";

export type PlaceNameSearchMeta = {
  apiOk: boolean;
  httpStatus: number;
  error?: string;
  serverDebug?: unknown;
};

export function usePlaceNameSearchResults(
  q: string,
  enabled: boolean,
  userLat: number | null | undefined,
  userLng: number | null | undefined
) {
  const [items, setItems] = useState<HomeCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<PlaceNameSearchMeta | null>(null);
  /** 재검색 시 이전 응답이 아직 도착해도 적용하지 않도록 */
  const fetchEpochRef = useRef(0);

  useLayoutEffect(() => {
    if (!enabled || !q.trim()) {
      return;
    }
    fetchEpochRef.current += 1;
    setLoading(true);
    setItems([]);
    setMeta(null);
  }, [enabled, q]);

  useEffect(() => {
    if (!enabled || !q.trim()) {
      setItems([]);
      setLoading(false);
      setMeta(null);
      return;
    }

    const epoch = fetchEpochRef.current;
    let cancelled = false;

    setLoading(true);

    (async () => {
      const searchQuery = String(q ?? "").trim();
      try {
        const params = new URLSearchParams({ q: searchQuery });
        if (userLat != null && userLng != null && Number.isFinite(userLat) && Number.isFinite(userLng)) {
          params.set("lat", String(userLat));
          params.set("lng", String(userLng));
        }
        if (process.env.NODE_ENV === "development") {
          params.set("debug", "1");
        }
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.log("[place-search] query:", searchQuery, "epoch:", epoch);
        }
        const res = await fetch(`/api/stores/search-by-name?${params.toString()}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as { items?: RepoStoreRow[]; error?: string; debug?: unknown };

        if (cancelled || epoch !== fetchEpochRef.current) {
          return;
        }

        const rows = json.items ?? [];
        const fetchError = !res.ok ? (json.error ?? `http_${res.status}`) : json.error ?? null;

        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.log("[place-search] data:", rows);
          // eslint-disable-next-line no-console
          console.log("[place-search] error:", fetchError);
        }

        const nextMeta: PlaceNameSearchMeta = {
          apiOk: res.ok,
          httpStatus: res.status,
          error: json.error,
          serverDebug: json.debug,
        };
        setMeta(nextMeta);

        if (!res.ok && process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.warn("[usePlaceNameSearchResults]", res.status, json.error ?? json);
        }
        const cards = rows.map((r) => toHomeCard(r)).map((c) => attachDistanceToCard(c, userLat, userLng));
        setItems(cards);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.log("[place-search] data:", null);
          // eslint-disable-next-line no-console
          console.log("[place-search] error:", err);
        }
        if (!cancelled && epoch === fetchEpochRef.current) {
          setItems([]);
          setMeta({ apiOk: false, httpStatus: 0, error: "network" });
        }
      } finally {
        if (!cancelled && epoch === fetchEpochRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [q, enabled, userLat, userLng]);

  return { items, loading, meta };
}
