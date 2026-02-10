// app/api/auth/kakao/login/route.ts
import { NextRequest, NextResponse } from "next/server";

function getRedirectUri(req: NextRequest): string {
  const host = req.headers.get("host") || req.headers.get("x-forwarded-host");
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host?.includes("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}/api/auth/kakao/callback`;
  const fallback = (process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI || "").trim();
  return fallback || "http://localhost:3000/api/auth/kakao/callback";
}

export async function GET(req: NextRequest) {
  const REST_KEY = (process.env.KAKAO_REST_API_KEY || "").trim();
  const redirectUri = getRedirectUri(req);

  if (!REST_KEY || !redirectUri) {
    return new Response("Kakao env not set", { status: 500 });
  }

  const returnTo = req.nextUrl.searchParams.get("return_to")?.trim() || "";
  const state = returnTo ? encodeURIComponent(returnTo) : "";

  const params = new URLSearchParams({
    client_id: REST_KEY,
    redirect_uri: redirectUri,
    response_type: "code",
  });
  if (state) params.set("state", state);

  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(kakaoAuthUrl);
}
