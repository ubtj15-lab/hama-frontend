/** 카카오 로그인 redirect URL (localStorage 없이 서버 OAuth만 사용) */
export function kakaoLoginUrl(nextPath?: string): string {
  const next =
    typeof nextPath === "string" && nextPath.trim().length > 0
      ? nextPath.trim().startsWith("/")
        ? nextPath.trim()
        : `/${nextPath.trim()}`
      : typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/";
  return `/api/auth/kakao/login?next=${encodeURIComponent(next)}`;
}

export function redirectToKakaoLogin(nextPath?: string): void {
  if (typeof window === "undefined") return;
  window.location.href = kakaoLoginUrl(nextPath);
}
