import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env
  .NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

function normalizeClientUserId(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = String(v).trim();
  if (!t || t.startsWith("session_")) return null;
  if (t.startsWith("user_")) return t.slice(5);
  return t;
}

async function resolvePublicUserId(
  req: NextRequest,
  supabase: ReturnType<typeof getSupabase>,
  incoming: string | null | undefined
): Promise<string | null> {
  const normalized = normalizeClientUserId(incoming);
  if (normalized) return normalized;

  const cookieUserId = req.cookies.get("hama_user_id")?.value?.trim();
  if (cookieUserId) return cookieUserId;

  const kakaoId = req.cookies.get("hama_kakao_id")?.value?.trim();
  if (!kakaoId || !supabase) return null;
  try {
    const { data, error } = await supabase.from("users").select("id").eq("kakao_id", kakaoId).single();
    if (error) {
      console.error("resolvePublicUserId(users by kakao_id) failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error("resolvePublicUserId failed:", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const events = Array.isArray(body) ? body : [body];

    const supabase = getSupabase();
    if (supabase) {
      const rows = await Promise.all(
        events.map(async (e: { user_id?: string; session_id?: string; type?: string; data?: object }) => ({
          user_id: await resolvePublicUserId(req, supabase, e.user_id ?? null),
          session_id: e.session_id ?? "unknown",
          type: e.type ?? "unknown",
          data: e.data ?? {},
        }))
      );
      const { error } = await supabase.from("events").insert(rows);
      if (error) console.error("HAMA LOG Supabase:", error);
    } else {
      console.log("HAMA LOG (no Supabase):", body);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("HAMA LOG ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "log failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: true, message: "log endpoint running" },
    { status: 200 }
  );
}
