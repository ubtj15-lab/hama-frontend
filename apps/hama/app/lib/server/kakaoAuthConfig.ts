import type { NextRequest } from "next/server";

export type KakaoAuthEnv = {
  clientId: string;
  /** Empty string when unset — omit from token request rather than sending blank. */
  clientSecret: string;
  redirectUri: string;
};

export type KakaoAuthEnvResult =
  | { ok: true; env: KakaoAuthEnv }
  | { ok: false; missing: string[] };

/**
 * Prefer explicit env redirect URI; otherwise derive from the request host.
 * Login + token exchange must use the exact same value.
 */
export function resolveKakaoRedirectUri(req: NextRequest): string {
  const fromEnv = (
    process.env.KAKAO_REDIRECT_URI ||
    process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ||
    ""
  ).trim();
  if (fromEnv) return fromEnv;

  const host = req.headers.get("host") || req.headers.get("x-forwarded-host");
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host?.includes("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}/api/auth/kakao/callback`;

  return "http://localhost:3000/api/auth/kakao/callback";
}

export function getKakaoAuthEnv(req: NextRequest): KakaoAuthEnvResult {
  const clientId = (
    process.env.KAKAO_CLIENT_ID ||
    process.env.KAKAO_REST_API_KEY ||
    ""
  ).trim();
  const clientSecret = (process.env.KAKAO_CLIENT_SECRET || "").trim();
  const redirectUri = resolveKakaoRedirectUri(req);

  const missing: string[] = [];
  // Only client id is hard-required. Secret and redirect URI env are optional:
  // production today works with KAKAO_REST_API_KEY + host-derived redirect URI.
  if (!clientId) missing.push("KAKAO_CLIENT_ID_or_KAKAO_REST_API_KEY");
  if (!redirectUri) missing.push("KAKAO_REDIRECT_URI");

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    env: { clientId, clientSecret, redirectUri },
  };
}
