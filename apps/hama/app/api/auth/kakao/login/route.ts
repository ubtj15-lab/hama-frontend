// app/api/auth/kakao/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getKakaoAuthEnv } from "@/lib/server/kakaoAuthConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function loginFailedRedirect(req: NextRequest, reason: string): NextResponse {
  const url = new URL("/", req.url);
  url.searchParams.set("login", "failed");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const envResult = getKakaoAuthEnv(req);
  if (!envResult.ok) {
    const reason = `missing_env:${envResult.missing.join(",")}`;
    console.error("[kakao/login] missing env", { missing: envResult.missing });
    return loginFailedRedirect(req, reason);
  }

  const { clientId, redirectUri } = envResult.env;

  const returnTo =
    req.nextUrl.searchParams.get("next")?.trim() ||
    req.nextUrl.searchParams.get("return_to")?.trim() ||
    "";
  const state = returnTo ? encodeURIComponent(returnTo) : "";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
  });
  if (state) params.set("state", state);

  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  return NextResponse.redirect(kakaoAuthUrl);
}
