import { sanitizeReturnPath } from "@/lib/auth/safeReturnPath";

/** 카카오 로그인 redirect URL (localStorage 없이 서버 OAuth만 사용) */
export function kakaoLoginUrl(nextPath?: string): string {
  const requested =
    typeof nextPath === "string" && nextPath.trim().length > 0
      ? nextPath.trim()
      : typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/";
  const withSlash = requested.startsWith("/") ? requested : `/${requested}`;
  const next = sanitizeReturnPath(withSlash);
  return `/api/auth/kakao/login?next=${encodeURIComponent(next)}`;
}

export function redirectToKakaoLogin(nextPath?: string): void {
  if (typeof window === "undefined") return;
  window.location.href = kakaoLoginUrl(nextPath);
}
