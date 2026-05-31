// app/api/auth/kakao/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { clearAuthSessionCookies } from "@/lib/server/authCookies";

export async function GET(req: NextRequest) {
  const REST_KEY = (process.env.KAKAO_REST_API_KEY || "").trim();
  const fallback =
    (process.env.NEXT_PUBLIC_KAKAO_LOGOUT_REDIRECT_URI || "").trim();

  if (!REST_KEY) {
    const res = NextResponse.redirect(new URL("/", req.url));
    clearAuthSessionCookies(res);
    return res;
  }

  const host = req.headers.get("host") || req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  let logoutRedirectUri: string;
  if (host) {
    logoutRedirectUri = `${proto}://${host}/`;
  } else {
    try {
      const url = new URL(req.url);
      logoutRedirectUri = url.origin;
    } catch {
      logoutRedirectUri = fallback || "http://localhost:3000";
    }
  }
  if (!logoutRedirectUri) logoutRedirectUri = "http://localhost:3000/";
  if (!logoutRedirectUri.endsWith("/")) logoutRedirectUri += "/";

  const params = new URLSearchParams({
    client_id: REST_KEY,
    logout_redirect_uri: logoutRedirectUri,
  });

  const kakaoLogoutUrl = `https://kauth.kakao.com/oauth/logout?${params.toString()}`;

  const res = NextResponse.redirect(kakaoLogoutUrl);
  clearAuthSessionCookies(res);
  return res;
}
