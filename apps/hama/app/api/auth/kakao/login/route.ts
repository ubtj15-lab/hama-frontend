// app/api/auth/kakao/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sanitizeReturnPath } from "@/lib/auth/safeReturnPath";
import { getKakaoAuthEnv } from "@/lib/server/kakaoAuthConfig";
import {
  HAMA_KAKAO_OAUTH_COOKIE,
  oauthStateCookieOptions,
  sealOAuthState,
} from "@/lib/server/kakaoOAuthState";

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
  const requested =
    req.nextUrl.searchParams.get("next")?.trim() ||
    req.nextUrl.searchParams.get("return_to")?.trim() ||
    "";
  const issued = sealOAuthState(requested || "/");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state: issued.state,
  });

  const res = NextResponse.redirect(`https://kauth.kakao.com/oauth/authorize?${params.toString()}`);
  res.cookies.set(HAMA_KAKAO_OAUTH_COOKIE, issued.cookie, oauthStateCookieOptions());
  return res;
}
