"use client";

import { useCallback, useEffect, useState } from "react";
import type { HomeCard } from "@/lib/storeTypes";
import { storeToHomeCard } from "@/lib/storeMappers";
import { getUserId } from "@hama/shared";

export function useSaved() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedCards, setSavedCards] = useState<HomeCard[]>([]);
  const [loading, setLoading] = useState(false);
  const userId = getUserId();

  const fetchSaved = useCallback(async () => {
    if (!userId || userId.startsWith("server")) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/saved?user_id=${encodeURIComponent(userId)}`
      );
      const json = await res.json();
      setSavedIds(new Set(json.saved_ids ?? []));
      setSavedCards((json.stores ?? []).map((s: Record<string, unknown>) => storeToHomeCard(s)));
    } catch {
      setSavedIds(new Set());
      setSavedCards([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const toggleSaved = useCallback(
    async (storeId: string) => {
      if (!userId || userId.startsWith("server")) return false;
      const prev = savedIds.has(storeId);
      setSavedIds((s) => {
        const next = new Set(s);
        if (prev) next.delete(storeId);
        else next.add(storeId);
        return next;
      });
      try {
        const res = await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, store_id: storeId }),
        });
        const json = await res.json();
        if (!json.ok) {
          setSavedIds((s) => {
            const next = new Set(s);
            if (prev) next.add(storeId);
            else next.delete(storeId);
            return next;
          });
          return prev;
        }
        return json.saved;
      } catch {
        setSavedIds((s) => {
          const next = new Set(s);
          if (prev) next.add(storeId);
          else next.delete(storeId);
          return next;
        });
        return prev;
      }
    },
    [userId, savedIds]
  );

  const isSaved = useCallback(
    (storeId: string) => savedIds.has(storeId),
    [savedIds]
  );

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  return { savedIds, savedCards, loading, toggleSaved, isSaved, refetch: fetchSaved };
}
