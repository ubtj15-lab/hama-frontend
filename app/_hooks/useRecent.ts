"use client";

import { useCallback, useEffect, useState } from "react";
import type { HomeCard } from "@/lib/storeTypes";
import { storeToHomeCard } from "@/lib/storeMappers";
import { getUserId } from "@/_lib/userIdentity";

export function useRecent() {
  const [recentCards, setRecentCards] = useState<HomeCard[]>([]);
  const [loading, setLoading] = useState(false);
  const userId = getUserId();

  const fetchRecent = useCallback(async () => {
    if (!userId || userId.startsWith("server")) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/recent?user_id=${encodeURIComponent(userId)}&limit=20`
      );
      const json = await res.json();
      const stores = json.stores ?? [];
      setRecentCards(stores.map((s: Record<string, unknown>) => storeToHomeCard(s)));
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
        await fetch("/api/recent/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, store_id: storeId }),
        });
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
