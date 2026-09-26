import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";
import { sanitizeReturnPath } from "@/lib/auth/safeReturnPath";

export const HAMA_KAKAO_OAUTH_COOKIE = "hama_kakao_oauth";
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_STATE_MAX_AGE_SECONDS = OAUTH_STATE_TTL_MS / 1000;
const USED_STATE_LIMIT = 5000;

export type OAuthStateFailure = "state_missing" | "state_mismatch" | "state_expired" | "state_reused";

type StoredState = {
  v: 1;
  s: string;
  p: string;
  e: number;
};

const usedStates = new Map<string, number>();

export function createOAuthStateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sealOAuthState(returnTo: string, now = Date.now(), state = createOAuthStateToken()): {
  state: string;
  cookie: string;
  returnTo: string;
  exp: number;
} {
  const safePath = sanitizeReturnPath(returnTo);
  const exp = now + OAUTH_STATE_TTL_MS;
  const payload: StoredState = { v: 1, s: state, p: safePath, e: exp };
  return {
    state,
    cookie: Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"),
    returnTo: safePath,
    exp,
  };
}

export function oauthStateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth/kakao",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  };
}

export function clearOAuthStateCookie(res: NextResponse): void {
  res.cookies.set(HAMA_KAKAO_OAUTH_COOKIE, "", {
    ...oauthStateCookieOptions(),
    maxAge: 0,
  });
}

function stateKey(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

function statesMatch(stored: string, presented: string): boolean {
  const left = createHash("sha256").update(stored).digest();
  const right = createHash("sha256").update(presented).digest();
  return timingSafeEqual(left, right);
}

function pruneUsed(now: number): void {
  for (const [key, exp] of usedStates) {
    if (exp <= now) usedStates.delete(key);
  }
  while (usedStates.size > USED_STATE_LIMIT) {
    const oldest = usedStates.keys().next().value;
    if (!oldest) break;
    usedStates.delete(oldest);
  }
}

function readStored(cookieValue: string): StoredState | null {
  try {
    const parsed = JSON.parse(Buffer.from(cookieValue, "base64url").toString("utf8")) as Partial<StoredState>;
    if (parsed.v !== 1 || typeof parsed.s !== "string" || typeof parsed.p !== "string" || typeof parsed.e !== "number") {
      return null;
    }
    if (!Number.isFinite(parsed.e) || !parsed.s) return null;
    return { v: 1, s: parsed.s, p: parsed.p, e: parsed.e };
  } catch {
    return null;
  }
}

/**
 * 쿠키와 쿼리 state가 같은 일회성 값일 때만 복귀 경로를 돌려준다.
 * 사용한 state는 이 프로세스에서 다시 받지 않는다.
 */
export function consumeOAuthState(
  cookieValue: string | undefined,
  presented: string | null,
  now = Date.now()
): { ok: true; returnTo: string } | { ok: false; reason: OAuthStateFailure } {
  pruneUsed(now);
  if (!cookieValue || !presented) return { ok: false, reason: "state_missing" };
  const stored = readStored(cookieValue);
  if (!stored || sanitizeReturnPath(stored.p) !== stored.p) return { ok: false, reason: "state_mismatch" };
  if (stored.e <= now) return { ok: false, reason: "state_expired" };
  const key = stateKey(stored.s);
  if (usedStates.has(key)) return { ok: false, reason: "state_reused" };
  if (!statesMatch(stored.s, presented)) return { ok: false, reason: "state_mismatch" };
  usedStates.set(key, stored.e);
  return { ok: true, returnTo: stored.p };
}

export function resetOAuthStateReuseForTests(): void {
  usedStates.clear();
}
