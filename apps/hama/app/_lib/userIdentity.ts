// app/_lib/userIdentity.ts

import { getOrCreateSessionId } from "./sessionId";

const LOGIN_FLAG_KEY = "hamaLoggedIn";
const USER_KEY = "hamaUser";

/** 로그인 시: user_xxx(DB UUID), 비로그인: session_xxx */
export function getUserId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const flag = window.localStorage.getItem(LOGIN_FLAG_KEY);
    if (flag === "1") {
      const raw = window.localStorage.getItem(USER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const dbUserId = parsed?.user_id;
        if (dbUserId) return `user_${dbUserId}`;
      }
    }
    return `session_${getOrCreateSessionId()}`;
  } catch {
    return `session_${getOrCreateSessionId()}`;
  }
}

/** DB users.id (UUID) 반환, 없으면 null */
export function getDbUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user_id ?? null;
  } catch {
    return null;
  }
}
