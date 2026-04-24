"use client";

import { useEffect } from "react";
import { getOrCreateSessionId } from "@hama/shared";

const USER_KEY = "hamaUser";
const LOGIN_FLAG_KEY = "hamaLoggedIn";
const COOKIE_USER_ID = "hama_user_id";
const COOKIE_NICKNAME = "hama_user_nickname";
const COOKIE_KAKAO_ID = "hama_kakao_id";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export function AuthSync() {
  useEffect(() => {
    const userId = getCookie(COOKIE_USER_ID);
    const nickname = getCookie(COOKIE_NICKNAME);
    const kakaoId = getCookie(COOKIE_KAKAO_ID);

    if (userId) {
      try {
        const raw = window.localStorage.getItem(USER_KEY);
        const prev = raw ? JSON.parse(raw) : {};
        const user = {
          ...prev,
          user_id: userId,
          kakao_id: kakaoId ?? prev.kakao_id ?? null,
          nickname: nickname ? decodeURIComponent(nickname) : prev.nickname ?? "카카오 사용자",
          points: typeof prev.points === "number" ? prev.points : 0,
        };
        window.localStorage.setItem(USER_KEY, JSON.stringify(user));
        window.localStorage.setItem(LOGIN_FLAG_KEY, "1");
        window.dispatchEvent(new Event("storage"));

        // 로그인 직후, 같은 session_id로 쌓인 익명 이벤트 user_id backfill
        const sessionId = getOrCreateSessionId();
        const backfillKey = `hama_backfill_${sessionId}_${userId}`;
        if (sessionId && !window.sessionStorage.getItem(backfillKey)) {
          window.sessionStorage.setItem(backfillKey, "1");
          void fetch("/api/auth/backfill-events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, user_id: userId }),
          }).catch((e) => {
            console.error("auth backfill fetch failed:", e);
          });
        }
      } catch {
        console.error("AuthSync failed");
      }
    }
  }, []);

  return null;
}
