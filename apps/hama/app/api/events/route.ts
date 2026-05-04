import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as
    | string
    | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function normalizeClientUserId(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = String(v).trim();
  if (!t || t.startsWith("session_")) return null;
  if (t.startsWith("user_")) return t.slice(5);
  return t;
}

async function resolveUserId(
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
    if (error) return null;
    return data?.id ?? null;
  } catch {
    return null;
  }
}

type Body = {
  event_name?: string;
  session_id?: string | null;
  user_id?: string | null;
  query?: string | null;
  intent?: string | null;
  category?: string | null;
  mode?: string | null;
  source?: string | null;
  place_id?: string | null;
  place_name?: string | null;
  place_category?: string | null;
  rank_position?: number | null;
  action?: string | null;
  situation_tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const event_name = typeof body.event_name === "string" ? body.event_name.trim() : "";
    if (!event_name) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabase = getSupabase();
    const resolvedUserId = await resolveUserId(req, supabase, body.user_id ?? null);

    const row = {
      event_name,
      session_id: body.session_id ?? null,
      user_id: resolvedUserId ?? null,
      query: body.query ?? null,
      intent: body.intent ?? null,
      category: body.category ?? null,
      mode: body.mode ?? null,
      source: body.source ?? null,
      place_id: body.place_id ?? null,
      place_name: body.place_name ?? null,
      place_category: body.place_category ?? null,
      rank_position: typeof body.rank_position === "number" ? body.rank_position : null,
      action: body.action ?? null,
      situation_tags: Array.isArray(body.situation_tags) ? body.situation_tags : null,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    };

    if (!supabase) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const { error } = await supabase.from("hama_events").insert(row);
    if (error) {
      console.warn("[api/events] insert failed:", error.message);
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.warn("[api/events] error:", e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
