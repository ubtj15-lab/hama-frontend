import { getOrCreateSessionId } from "./sessionId";

const LOGIN_FLAG_KEY = "hamaLoggedIn";
const USER_KEY = "hamaUser";
const COOKIE_USER_ID = "hama_user_id";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/** 로그인 시: user_xxx(DB UUID), 비로그인: session_xxx */
export function getUserId(): string {
  if (typeof window === "undefined") return "server";
  try {
    // 가장 먼저 쿠키/스토리지의 DB user id를 확인해 로그인 상태를 보장한다.
    const dbUserId = getDbUserId();
    if (dbUserId) return `user_${dbUserId}`;

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
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.user_id) return parsed.user_id;
    }
    const fromCookie = getCookie(COOKIE_USER_ID);
    if (fromCookie) return fromCookie;
    return null;
  } catch {
    const fromCookie = getCookie(COOKIE_USER_ID);
    return fromCookie ?? null;
  }
}
