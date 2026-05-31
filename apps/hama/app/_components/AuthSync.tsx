"use client";

import { useEffect } from "react";
import { getOrCreateSessionId } from "@hama/shared";

/** 로그인 직후 익명 이벤트를 user_id로 backfill (localStorage 로그인 플래그는 사용하지 않음) */
export function AuthSync() {
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json().catch(() => ({}))) as { user?: { id?: string } | null };
        const userId = json?.user?.id?.trim();
        if (!userId) return;

        const sessionId = getOrCreateSessionId();
        const backfillKey = `hama_backfill_${sessionId}_${userId}`;
        if (sessionId && !window.sessionStorage.getItem(backfillKey)) {
          window.sessionStorage.setItem(backfillKey, "1");
          void fetch("/api/auth/backfill-events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ session_id: sessionId, user_id: userId }),
          }).catch((e) => {
            console.error("auth backfill fetch failed:", e);
          });
        }
      } catch {
        console.error("AuthSync failed");
      }
    })();
  }, []);

  return null;
}
