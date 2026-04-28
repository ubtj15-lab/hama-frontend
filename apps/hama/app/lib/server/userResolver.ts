import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "./supabaseAdmin";

function normalizeClientUserId(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = String(v).trim();
  if (!t || t.startsWith("session_")) return null;
  if (t.startsWith("user_")) return t.slice(5);
  return t;
}

export async function resolveUserIdFromRequest(
  req: NextRequest,
  incomingUserId?: string | null
): Promise<string | null> {
  const normalized = normalizeClientUserId(incomingUserId ?? null);
  if (normalized) return normalized;

  const cookieUserId = req.cookies.get("hama_user_id")?.value?.trim();
  if (cookieUserId) return cookieUserId;

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
