// app/api/auth/kakao/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { applyAuthSessionCookies } from "@/lib/server/authCookies";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

function getRedirectUri(req: NextRequest): string {
  const host = req.headers.get("host") || req.headers.get("x-forwarded-host");
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host?.includes("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}/api/auth/kakao/callback`;
  const fallback = (process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI || "").trim();
  return fallback || "http://localhost:3000/api/auth/kakao/callback";
}

function safeReturnPath(state: string | null): string {
  if (!state) return "/";
  try {
    const decoded = decodeURIComponent(state);
    return decoded.startsWith("/") ? decoded : "/";
  } catch {
    return "/";
  }
}

function loginFailedRedirect(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/?login=failed", req.url));
}

export async function GET(req: NextRequest) {
  const REST_KEY = (process.env.KAKAO_REST_API_KEY || "").trim();
  const redirectUri = getRedirectUri(req);

  if (!REST_KEY || !redirectUri) {
    return new Response("Kakao env not set", { status: 500 });
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const returnTo = safeReturnPath(state);

  if (!code) {
    return loginFailedRedirect(req);
  }

  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: REST_KEY,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!tokenRes.ok) {
    return loginFailedRedirect(req);
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenJson.access_token;

  if (!accessToken) {
    return loginFailedRedirect(req);
  }

  const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    return loginFailedRedirect(req);
  }

  const kakaoUser = (await userRes.json()) as {
    id?: number | string;
    kakao_account?: { profile?: { nickname?: string } };
    properties?: { nickname?: string };
  };
  const kakaoId = String(kakaoUser?.id ?? "");
  const nickname =
    kakaoUser?.kakao_account?.profile?.nickname ??
    kakaoUser?.properties?.nickname ??
    "카카오 사용자";

  if (!kakaoId) {
    return loginFailedRedirect(req);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return loginFailedRedirect(req);
  }

  let userId: string | null = null;
  let isNewUser = false;

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id")
    .eq("kakao_id", kakaoId)
    .maybeSingle();

  if (existingError) {
    return loginFailedRedirect(req);
  }

  if (existing?.id) {
    userId = existing.id;
    await supabase
      .from("users")
      .update({ nickname, updated_at: new Date().toISOString() })
      .eq("id", userId);
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("users")
      .insert({
        kakao_id: kakaoId,
        nickname,
        role: "consumer",
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      return loginFailedRedirect(req);
    }
    userId = inserted.id;
    isNewUser = true;
  }

  if (!userId) {
    return loginFailedRedirect(req);
  }

  const res = NextResponse.redirect(new URL(returnTo, req.url));
  applyAuthSessionCookies(res, { userId, nickname, kakaoId, isNewUser });
  return res;
}
