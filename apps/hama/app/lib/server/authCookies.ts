import type { NextResponse } from "next/server";

export const HAMA_USER_ID_COOKIE = "hama_user_id";
export const HAMA_USER_NICKNAME_COOKIE = "hama_user_nickname";
export const HAMA_KAKAO_ID_COOKIE = "hama_kakao_id";
export const HAMA_IS_NEW_USER_COOKIE = "hama_is_new_user";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const NEW_USER_MAX_AGE = 60 * 60 * 24 * 3;

export function authSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function applyAuthSessionCookies(
  res: NextResponse,
  params: { userId: string; nickname: string; kakaoId: string; isNewUser: boolean }
): void {
  const base = authSessionCookieOptions();
  res.cookies.set(HAMA_USER_ID_COOKIE, params.userId, base);
  res.cookies.set(HAMA_USER_NICKNAME_COOKIE, encodeURIComponent(params.nickname), {
    ...base,
    httpOnly: false,
  });
  res.cookies.set(HAMA_KAKAO_ID_COOKIE, params.kakaoId, { ...base, httpOnly: false });
  res.cookies.set(HAMA_IS_NEW_USER_COOKIE, params.isNewUser ? "1" : "0", {
    ...base,
    httpOnly: false,
    maxAge: NEW_USER_MAX_AGE,
  });
}

export function clearAuthSessionCookies(res: NextResponse): void {
  const clear = { maxAge: 0, path: "/" };
  res.cookies.set(HAMA_USER_ID_COOKIE, "", clear);
  res.cookies.set(HAMA_USER_NICKNAME_COOKIE, "", clear);
  res.cookies.set(HAMA_KAKAO_ID_COOKIE, "", clear);
  res.cookies.set(HAMA_IS_NEW_USER_COOKIE, "", clear);
}
