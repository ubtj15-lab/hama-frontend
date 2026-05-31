"use client";

import { useCallback, useEffect, useState } from "react";

export type HamaMeUser = {
  id: string;
  nickname: string;
  points: number;
};

type MeResponse = {
  user: HamaMeUser | null;
};

export function useHamaMe() {
  const [user, setUser] = useState<HamaMeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store", credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as MeResponse;
      const u = json?.user;
      if (u && typeof u.id === "string" && u.id.length > 0) {
        setUser({
          id: u.id,
          nickname: typeof u.nickname === "string" && u.nickname.length > 0 ? u.nickname : "카카오 사용자",
          points: typeof u.points === "number" && Number.isFinite(u.points) ? u.points : 0,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    user,
    isLoggedIn: Boolean(user),
    loading,
    refresh,
  };
}
