"use client";

import { useEffect } from "react";

const USER_KEY = "hamaUser";
const LOGIN_FLAG_KEY = "hamaLoggedIn";
const COOKIE_USER_ID = "hama_user_id";
const COOKIE_NICKNAME = "hama_user_nickname";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export function AuthSync() {
  useEffect(() => {
    const userId = getCookie(COOKIE_USER_ID);
    const nickname = getCookie(COOKIE_NICKNAME);

    if (userId && nickname) {
      try {
        const raw = window.localStorage.getItem(USER_KEY);
        const prev = raw ? JSON.parse(raw) : {};
        const user = {
          ...prev,
          user_id: userId,
          nickname: decodeURIComponent(nickname),
          points: typeof prev.points === "number" ? prev.points : 0,
        };
        window.localStorage.setItem(USER_KEY, JSON.stringify(user));
        window.localStorage.setItem(LOGIN_FLAG_KEY, "1");
        window.dispatchEvent(new Event("storage"));
      } catch {
        // ignore
      }
    }
  }, []);

  return null;
}
