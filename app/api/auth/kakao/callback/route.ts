// app/api/auth/kakao/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env
  .NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

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

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code) {
    return new Response("No code from kakao", { status: 400 });
  }

  const returnTo = state ? decodeURIComponent(state) : "";

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
    return new Response("Failed to get token from kakao", { status: 500 });
  }

  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson.access_token;

  if (!accessToken) {
    return new Response("No access token from kakao", { status: 500 });
  }

  const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    const target = returnTo.startsWith("/") ? returnTo : "/";
    return NextResponse.redirect(new URL(target, req.url));
  }

  const kakaoUser = await userRes.json();
  const kakaoId = String(kakaoUser?.id ?? "");
  const nickname =
    kakaoUser?.kakao_account?.profile?.nickname ??
    kakaoUser?.properties?.nickname ??
    "카카오 사용자";

  const supabase = getSupabase();
  let userId: string | null = null;

  if (supabase && kakaoId) {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("kakao_id", kakaoId)
      .single();

    if (existing) {
      userId = existing.id;
      await supabase
        .from("users")
        .update({ nickname, updated_at: new Date().toISOString() })
        .eq("id", userId);
    } else {
      const { data: inserted, error } = await supabase
        .from("users")
        .insert({
          kakao_id: kakaoId,
          nickname,
          role: "consumer",
        })
        .select("id")
        .single();

      if (!error && inserted) userId = inserted.id;
    }
  }

  const target = returnTo.startsWith("/") ? returnTo : "/";
  const res = NextResponse.redirect(new URL(target, req.url));

  if (userId) {
    res.cookies.set("hama_user_id", userId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
    res.cookies.set("hama_user_nickname", encodeURIComponent(nickname), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }

  return res;
}
