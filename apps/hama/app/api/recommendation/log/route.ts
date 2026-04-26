import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const supabaseServiceKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

function getSupabaseService() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
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
  /**
   * 신규 분석 테이블(`recommendations` / `recommendation_responses` / `corrections`) 적재용.
   * 기존 `recommendation_events` 스트림과 병행한다.
   */
  analytics_v2?: {
    recommendation_id?: string | null;
    category_clicked?: string | null;
    user_profile?: Record<string, unknown> | null;
    shown_place_ids?: string[] | null;
    main_pick_id?: string | null;
    recommendation_reasons?: Record<string, unknown> | null;
    weights?: Record<string, unknown> | null;
    scenario?: string | null;
    weather?: string | null;
    day_of_week?: number | null;
    time_of_day?: string | null;
    action?: string | null;
    selected_place_id?: string | null;
    reject_reason?: string | null;
    correction_used?: string | null;
    correction_value?: unknown;
    correction_kind?: string | null;
    correction_free_text?: string | null;
  };
};

async function insertAnalyticsV2(body: Body, resolvedUserId: string | null) {
  const v2 = body.analytics_v2;
  if (!v2) return;

  const svc = getSupabaseService();
  if (!svc) return;

  const sessionId = String(body.session_id ?? "").trim() || null;
  const recommendationId = typeof v2.recommendation_id === "string" && v2.recommendation_id ? v2.recommendation_id : null;

  try {
    if (body.event_name === "recommendation_impression" && recommendationId) {
      const { error } = await svc.from("recommendations").insert({
        id: recommendationId,
        day_of_week: v2.day_of_week ?? null,
        time_of_day: v2.time_of_day ?? null,
        user_id: resolvedUserId,
        session_id: sessionId,
        user_profile: v2.user_profile ?? {},
        category_clicked: v2.category_clicked ?? null,
        scenario: v2.scenario ?? body.scenario ?? null,
        shown_place_ids: v2.shown_place_ids ?? [],
        main_pick_id: v2.main_pick_id ?? null,
        recommendation_reasons: v2.recommendation_reasons ?? {},
        weights: v2.weights ?? {},
        weather: v2.weather ?? null,
        metadata: {
          event_name: body.event_name,
          source_page: body.source_page ?? null,
          template_id: body.template_id ?? null,
          step_pattern: body.step_pattern ?? null,
          place_ids: body.place_ids ?? [],
          raw_metadata: body.metadata ?? {},
        },
      });
      if (error) console.error("recommendations insert:", error.message);
      return;
    }

    if (
      (body.event_name === "recommendation_response" ||
        body.event_name === "reject_main_pick" ||
        body.event_name === "place_click" ||
        body.event_name === "place_impression") &&
      recommendationId
    ) {
      const { error } = await svc.from("recommendation_responses").insert({
        recommendation_id: recommendationId,
        user_id: resolvedUserId,
        session_id: sessionId,
        action: String(v2.action ?? body.event_name),
        selected_place_id: v2.selected_place_id ?? body.entity_id ?? null,
        reject_reason: v2.reject_reason ?? null,
        correction_used: v2.correction_used ?? null,
        correction_value: v2.correction_value ?? null,
        metadata: {
          source_page: body.source_page ?? null,
          rank_position: body.recommendation_rank ?? null,
          raw_metadata: body.metadata ?? {},
        },
      });
      if (error) console.error("recommendation_responses insert:", error.message);
      return;
    }

    if (body.event_name === "correction_event" && recommendationId) {
      const { error } = await svc.from("corrections").insert({
        recommendation_id: recommendationId,
        user_id: resolvedUserId,
        session_id: sessionId,
        kind: String(v2.correction_kind ?? "unknown"),
        value: (v2.correction_value ?? {}) as any,
        free_text: v2.correction_free_text ?? null,
        metadata: {
          source_page: body.source_page ?? null,
          raw_metadata: body.metadata ?? {},
        },
      });
      if (error) console.error("corrections insert:", error.message);
    }
  } catch (e) {
    console.error("analytics_v2 insert failed:", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const supabase = getSupabase();
    const resolvedUserId = supabase ? await resolvePublicUserId(req, supabase, body.user_id ?? null) : null;
    if (supabase) {
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

    // v2 tables (best-effort; migration 미반영 환경은 조용히 실패)
    await insertAnalyticsV2(body, resolvedUserId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("recommendation log", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
