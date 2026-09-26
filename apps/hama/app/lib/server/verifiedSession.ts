import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { HAMA_SESSION_COOKIE, HAMA_SESSION_MAX_AGE_SECONDS } from "./authCookies";
import { getSupabaseAdmin } from "./supabaseAdmin";

const SESSION_MS = HAMA_SESSION_MAX_AGE_SECONDS * 1000;

export type SessionRecord = {
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionTokensMatch(storedHash: string, presentedToken: string): boolean {
  const presented = Buffer.from(hashSessionToken(presentedToken), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (presented.length !== stored.length || presented.length === 0) return false;
  return timingSafeEqual(presented, stored);
}

/** 세션 행만 판정한다. 쿠키의 사용자 ID나 요청 user_id는 받지 않는다. */
export function evaluateSession(
  record: SessionRecord | null,
  now = new Date()
): { ok: true; userId: string } | { ok: false; reason: "missing" | "expired" | "revoked" } {
  if (!record) return { ok: false, reason: "missing" };
  if (record.revokedAt) return { ok: false, reason: "revoked" };
  const expiresAt = record.expiresAt.getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true, userId: record.userId };
}

export function readSessionCookie(req: NextRequest): string | null {
  const token = req.cookies.get(HAMA_SESSION_COOKIE)?.value?.trim();
  return token || null;
}

export async function getVerifiedUserId(req: NextRequest): Promise<string | null> {
  const token = readSessionCookie(req);
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  try {
    const tokenHash = hashSessionToken(token);
    const { data, error } = await supabase
      .from("hama_sessions")
      .select("user_id, expires_at, revoked_at, token_hash")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error || !data?.user_id || typeof data.token_hash !== "string") return null;
    if (!sessionTokensMatch(data.token_hash, token)) return null;
    const decision = evaluateSession({
      userId: String(data.user_id),
      expiresAt: new Date(String(data.expires_at)),
      revokedAt: data.revoked_at ? new Date(String(data.revoked_at)) : null,
    });
    return decision.ok ? decision.userId : null;
  } catch {
    return null;
  }
}

export async function issueServerSession(userId: string): Promise<{ token: string; expiresAt: Date } | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !userId.trim()) return null;
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  try {
    const { error } = await supabase.from("hama_sessions").insert({
      user_id: userId,
      token_hash: hashSessionToken(token),
      expires_at: expiresAt.toISOString(),
    });
    if (error) return null;
    return { token, expiresAt };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date): void {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  res.cookies.set(HAMA_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
    expires: expiresAt,
  });
}

export async function revokeServerSession(req: NextRequest): Promise<void> {
  const token = readSessionCookie(req);
  if (!token) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  try {
    await supabase
      .from("hama_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashSessionToken(token))
      .is("revoked_at", null);
  } catch {
    return;
  }
}
