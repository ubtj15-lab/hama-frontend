// app/api/auth/kakao/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { applyAuthSessionCookies } from "@/lib/server/authCookies";
import { getKakaoAuthEnv } from "@/lib/server/kakaoAuthConfig";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function loginFailedRedirect(req: NextRequest, reason: string): NextResponse {
  const url = new URL("/", req.url);
  url.searchParams.set("login", "failed");
  url.searchParams.set("reason", reason.slice(0, 180));
  return NextResponse.redirect(url);
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

export async function GET(req: NextRequest) {
  const envResult = getKakaoAuthEnv(req);
  if (!envResult.ok) {
    const reason = `missing_env:${envResult.missing.join(",")}`;
    console.error("[kakao/callback] missing env", { missing: envResult.missing });
    return loginFailedRedirect(req, reason);
  }

  const { clientId, clientSecret, redirectUri } = envResult.env;
  const returnTo = safeReturnPath(req.nextUrl.searchParams.get("state"));

  const kakaoError = req.nextUrl.searchParams.get("error");
  const kakaoErrorDescription = req.nextUrl.searchParams.get("error_description");
  if (kakaoError) {
    const reason = `kakao_oauth_error:${kakaoError}`;
    console.error("[kakao/callback] Kakao OAuth error", {
      error: kakaoError,
      error_description: kakaoErrorDescription,
    });
    return loginFailedRedirect(req, reason);
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    console.error("[kakao/callback] authorization code missing", {
      search: req.nextUrl.search,
    });
    return loginFailedRedirect(req, "missing_code");
  }

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
  });
  // Match previous production behavior: only send secret when configured.
  if (clientSecret) tokenBody.set("client_secret", clientSecret);

  let tokenRes: Response;
  try {
    tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    console.error("[kakao/callback] token request network error", { message });
    return loginFailedRedirect(req, "token_request_network_error");
  }

  const tokenRaw = await tokenRes.text();
  let tokenJson: { access_token?: string; error?: string; error_description?: string } = {};
  try {
    tokenJson = JSON.parse(tokenRaw) as typeof tokenJson;
  } catch {
    /* non-JSON body handled below */
  }

  if (!tokenRes.ok) {
    const kakaoMsg = tokenJson.error_description || tokenJson.error || tokenRaw.slice(0, 200);
    console.error("[kakao/callback] token request failed", {
      status: tokenRes.status,
      redirectUri,
      kakaoError: tokenJson.error,
      kakaoErrorDescription: tokenJson.error_description,
      body: tokenRaw.slice(0, 500),
    });
    const reason =
      tokenJson.error === "invalid_grant" && /redirect/i.test(String(kakaoMsg))
        ? "redirect_uri_mismatch"
        : `token_request_failed:${tokenJson.error || tokenRes.status}`;
    return loginFailedRedirect(req, reason);
  }

  const accessToken = tokenJson.access_token;
  if (!accessToken) {
    console.error("[kakao/callback] access_token missing in token response", {
      body: tokenRaw.slice(0, 500),
    });
    return loginFailedRedirect(req, "missing_access_token");
  }

  let userRes: Response;
  try {
    userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    console.error("[kakao/callback] user info request network error", { message });
    return loginFailedRedirect(req, "user_info_network_error");
  }

  const userRaw = await userRes.text();
  if (!userRes.ok) {
    console.error("[kakao/callback] user info request failed", {
      status: userRes.status,
      body: userRaw.slice(0, 500),
    });
    return loginFailedRedirect(req, `user_info_failed:${userRes.status}`);
  }

  let kakaoUser: {
    id?: number | string;
    kakao_account?: { profile?: { nickname?: string } };
    properties?: { nickname?: string };
  };
  try {
    kakaoUser = JSON.parse(userRaw) as typeof kakaoUser;
  } catch {
    console.error("[kakao/callback] user info JSON parse failed", { body: userRaw.slice(0, 500) });
    return loginFailedRedirect(req, "user_info_parse_failed");
  }

  const kakaoId = String(kakaoUser?.id ?? "");
  const nickname =
    kakaoUser?.kakao_account?.profile?.nickname ??
    kakaoUser?.properties?.nickname ??
    "카카오 사용자";

  if (!kakaoId) {
    console.error("[kakao/callback] kakao user id missing", { kakaoUser });
    return loginFailedRedirect(req, "missing_kakao_user_id");
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error(
      "[kakao/callback] Supabase admin unavailable — check NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"
    );
    return loginFailedRedirect(req, "supabase_unavailable");
  }

  const supabaseHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host || "missing_host";
    } catch {
      return "invalid_supabase_url";
    }
  })();

  let userId: string | null = null;
  let isNewUser = false;

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id")
    .eq("kakao_id", kakaoId)
    .maybeSingle();

  if (existingError) {
    const raw = `${existingError.code || "unknown"}:${existingError.message || "no_message"}`;
    const isFetchFailed = /fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(raw);
    const detail = (isFetchFailed
      ? `supabase_unreachable:${supabaseHost}`
      : raw
    )
      .replace(/\s+/g, "_")
      .slice(0, 120);
    console.error("[kakao/callback] users lookup failed", {
      kakaoId,
      supabaseHost,
      error: existingError.message,
      code: existingError.code,
      details: existingError.details,
      hint: existingError.hint,
    });
    return loginFailedRedirect(req, `users_lookup_failed:${detail}`);
  }

  if (existing?.id) {
    userId = existing.id;
    const { error: updateError } = await supabase
      .from("users")
      .update({ nickname, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (updateError) {
      const detail = `${updateError.code || "unknown"}:${updateError.message || "no_message"}`
        .replace(/\s+/g, "_")
        .slice(0, 120);
      console.error("[kakao/callback] users update failed", {
        userId,
        error: updateError.message,
        code: updateError.code,
      });
      return loginFailedRedirect(req, `users_update_failed:${detail}`);
    }
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
      const detail = `${insertError?.code || "unknown"}:${insertError?.message || "no_id"}`
        .replace(/\s+/g, "_")
        .slice(0, 120);
      console.error("[kakao/callback] users insert failed", {
        kakaoId,
        error: insertError?.message,
        code: insertError?.code,
      });
      return loginFailedRedirect(req, `users_insert_failed:${detail}`);
    }
    userId = inserted.id;
    isNewUser = true;
  }

  if (!userId) {
    console.error("[kakao/callback] userId unresolved after upsert", { kakaoId });
    return loginFailedRedirect(req, "missing_user_id");
  }

  const res = NextResponse.redirect(new URL(returnTo, req.url));
  applyAuthSessionCookies(res, { userId, nickname, kakaoId, isNewUser });
  console.info("[kakao/callback] login success", { userId, kakaoId, isNewUser, returnTo });
  return res;
}
