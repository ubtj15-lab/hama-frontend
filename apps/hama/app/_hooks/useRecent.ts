"use client";

import { useCallback, useEffect, useState } from "react";
import type { HomeCard } from "@/lib/storeTypes";
import { storeToHomeCard } from "@/lib/storeMappers";
import { applyDefaultImage } from "@/lib/defaultCardImage";
import { getUserId } from "@hama/shared";

export function useRecent() {
  const [recentCards, setRecentCards] = useState<HomeCard[]>([]);
  const [loading, setLoading] = useState(false);
  const userId = getUserId();

  const fetchRecent = useCallback(async () => {
    if (!userId || userId.startsWith("server")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/recent?limit=20", { credentials: "include" });
      if (res.status === 401) {
        setRecentCards([]);
        return;
      }
      if (!res.ok) return;
      const json = await res.json();
      const stores = json.stores ?? [];
      setRecentCards(
        stores.map((s: Record<string, unknown>) =>
          applyDefaultImage(storeToHomeCard(s))
        )
      );
    } catch {
      setRecentCards([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const recordView = useCallback(
    async (storeId: string) => {
      if (!userId || userId.startsWith("server")) return;
      try {
        const res = await fetch("/api/recent/record", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ store_id: storeId }),
        });
        if (!res.ok) return;
        await fetchRecent();
      } catch {
        // ignore
      }
    },
    [userId, fetchRecent]
  );

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  return { recentCards, loading, recordView, refetch: fetchRecent };
}
