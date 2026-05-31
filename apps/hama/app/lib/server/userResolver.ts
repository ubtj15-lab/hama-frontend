import type { NextRequest } from "next/server";
import { HAMA_USER_ID_COOKIE } from "./authCookies";
import { getSupabaseAdmin } from "./supabaseAdmin";

function normalizeClientUserId(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = String(v).trim();
  if (!t || t.startsWith("session_")) return null;
  if (t.startsWith("user_")) return t.slice(5);
  return t;
}

/** 영수증 인증 등 — httpOnly `hama_user_id` 쿠키만 허용 */
export function getUserIdFromAuthCookie(req: NextRequest): string | null {
  const id = req.cookies.get(HAMA_USER_ID_COOKIE)?.value?.trim();
  return id || null;
}

export async function resolveUserIdFromRequest(
  req: NextRequest,
  incomingUserId?: string | null
): Promise<string | null> {
  const cookieUserId = getUserIdFromAuthCookie(req);
  if (cookieUserId) return cookieUserId;

  const normalized = normalizeClientUserId(incomingUserId ?? null);
  if (normalized) return normalized;

  const kakaoId = req.cookies.get("hama_kakao_id")?.value?.trim();
  if (!kakaoId) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from("users").select("id").eq("kakao_id", kakaoId).single();
    if (error) return null;
    return data?.id ?? null;
  } catch {
    return null;
  }
}
