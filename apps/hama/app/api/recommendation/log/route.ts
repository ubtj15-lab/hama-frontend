import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

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
      console.error("resolvePublicUserId(recommendation by kakao_id) failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error("resolvePublicUserId(recommendation) failed:", e);
    return null;
  }
}

type Body = {
  session_id: string;
  user_id?: string | null;
  event_name: string;
  entity_type?: string | null;
  entity_id?: string | null;
  recommendation_rank?: number | null;
  scenario?: string | null;
  child_age_group?: string | null;
  weather_condition?: string | null;
  time_of_day?: string | null;
  date_time_band?: string | null;
  source_page?: string | null;
  place_snapshot?: Record<string, unknown> | null;
  course_snapshot?: Record<string, unknown> | null;
  created_at?: string | null;
  template_id?: string | null;
  step_pattern?: string | null;
  place_ids?: string[];
  metadata?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const supabase = getSupabase();
    if (supabase) {
      const resolvedUserId = await resolvePublicUserId(req, supabase, body.user_id ?? null);
      const row = {
        session_id: body.session_id ?? "unknown",
        user_id: resolvedUserId,
        event_name: body.event_name,
        entity_type: body.entity_type ?? null,
        entity_id: body.entity_id ?? null,
        rank_position: body.recommendation_rank ?? null,
        scenario: body.scenario ?? null,
        child_age_group: body.child_age_group ?? null,
        weather_condition: body.weather_condition ?? null,
        time_of_day: body.time_of_day ?? null,
        date_time_band: body.date_time_band ?? null,
        source_page: body.source_page ?? null,
        created_at: body.created_at ?? new Date().toISOString(),
        template_id: body.template_id ?? null,
        step_pattern: body.step_pattern ?? null,
        place_ids: body.place_ids ?? [],
        metadata: {
          ...(body.metadata ?? {}),
          place_snapshot: body.place_snapshot ?? null,
          course_snapshot: body.course_snapshot ?? null,
          recommendation_rank: body.recommendation_rank ?? null,
        },
      };
      const { error } = await supabase.from("recommendation_events").insert(row);
      if (error) console.error("recommendation_events insert:", error);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("recommendation log", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
