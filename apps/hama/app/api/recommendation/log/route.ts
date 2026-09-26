import { NextRequest, NextResponse } from "next/server";
import {
  mergeImpressionHistory,
  type RecommendationSessionSnapshot,
} from "@/lib/analytics/recommendationSessionSnapshot";
import { RECOMMENDATION_ENGINE_VERSION } from "@/lib/analytics/recommendationEngineVersion";
import {
  buildContextualRejectResponseRow,
  shouldSkipRecommendationEventsTable,
} from "@/lib/analytics/contextualRejectFeedback";
import { isRecommendationRejectReason } from "@/lib/analytics/recommendationRejectReasons";
import { boundedRecord, clipText, isAllowedRecommendationLogEvent } from "@/lib/server/activityEventGuard";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getVerifiedUserId } from "@/lib/server/verifiedSession";

export const dynamic = "force-dynamic";

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
    session_snapshot?: RecommendationSessionSnapshot | null;
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

async function insertAnalyticsV2(body: Body, resolvedUserId: string | null): Promise<boolean> {
  const v2 = body.analytics_v2;
  if (!v2) return true;

  const svc = getSupabaseAdmin();
  if (!svc) return false;

  const sessionId = String(body.session_id ?? "").trim() || null;
  const recommendationId = typeof v2.recommendation_id === "string" && v2.recommendation_id ? v2.recommendation_id : null;

  try {
    if (body.event_name === "recommendation_impression" && recommendationId) {
      const snapshot = v2.session_snapshot ?? null;
      const atIso = body.created_at ?? new Date().toISOString();
      const baseMetadata: Record<string, unknown> = {
        event_name: body.event_name,
        source_page: body.source_page ?? null,
        template_id: body.template_id ?? null,
        step_pattern: body.step_pattern ?? null,
        place_ids: body.place_ids ?? [],
        raw_metadata: body.metadata ?? {},
      };
      const metadata = snapshot
        ? mergeImpressionHistory(baseMetadata, snapshot, atIso)
        : baseMetadata;

      const row = {
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
        metadata,
      };

      const { error } = await svc.from("recommendations").insert(row);
      if (error) {
        const isDup = error.code === "23505" || /duplicate key/i.test(String(error.message ?? ""));
        if (!isDup || !resolvedUserId) {
          console.error("recommendations insert", error.code);
          return false;
        }
        try {
          const { data: existing, error: readError } = await svc
            .from("recommendations")
            .select("metadata")
            .eq("id", recommendationId)
            .eq("user_id", resolvedUserId)
            .maybeSingle();
          if (readError || !existing) {
            console.error("recommendations owner read", readError?.code ?? "not_owner");
            return false;
          }
          const prev =
            existing?.metadata && typeof existing.metadata === "object"
              ? (existing.metadata as Record<string, unknown>)
              : {};
          const merged = snapshot
            ? mergeImpressionHistory({ ...prev, ...baseMetadata }, snapshot, atIso)
            : { ...prev, ...baseMetadata };
          const { data: updated, error: upErr } = await svc
            .from("recommendations")
            .update({
              shown_place_ids: v2.shown_place_ids ?? [],
              main_pick_id: v2.main_pick_id ?? null,
              recommendation_reasons: v2.recommendation_reasons ?? {},
              weights: v2.weights ?? {},
              weather: v2.weather ?? null,
              scenario: v2.scenario ?? body.scenario ?? null,
              metadata: merged,
              day_of_week: v2.day_of_week ?? null,
              time_of_day: v2.time_of_day ?? null,
            })
            .eq("id", recommendationId)
            .eq("user_id", resolvedUserId)
            .select("id");
          if (upErr || !updated?.length) {
            console.error("recommendations update", upErr?.code ?? "not_owner");
            return false;
          }
        } catch (e) {
          console.error("recommendations upsert failed", e instanceof Error ? e.name : "error");
          return false;
        }
      }
      return true;
    }

    if (body.event_name === "contextual_reject" && recommendationId) {
      if (!isRecommendationRejectReason(v2.reject_reason)) {
        console.warn("contextual_reject ignored: invalid reject_reason");
        return true;
      }
      const placeId = String(v2.selected_place_id ?? body.entity_id ?? "").trim();
      if (!placeId) {
        console.warn("contextual_reject ignored: missing place_id");
        return true;
      }
      const meta = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
      const row = buildContextualRejectResponseRow({
        recommendationId,
        userId: resolvedUserId,
        sessionId,
        payload: {
          recommendation_id: recommendationId,
          place_id: placeId,
          reject_reason: v2.reject_reason,
          shown_position:
            typeof body.recommendation_rank === "number" ? body.recommendation_rank : null,
          distance_m_at_recommendation:
            typeof meta.distance_m_at_recommendation === "number"
              ? meta.distance_m_at_recommendation
              : null,
          feedback_source: "PRE_VISIT",
          engine_version: RECOMMENDATION_ENGINE_VERSION,
          shown_place_unverified: meta.shown_place_unverified === true,
          query: typeof meta.query === "string" ? meta.query : null,
          qu_snapshot:
            meta.qu_snapshot && typeof meta.qu_snapshot === "object"
              ? (meta.qu_snapshot as never)
              : null,
        },
        sourcePage: body.source_page ?? null,
      });
      const { error } = await svc.from("recommendation_responses").insert(row);
      if (error) {
        console.error("recommendation_responses insert", error.code);
        return false;
      }
      return true;
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
      if (error) {
        console.error("recommendation_responses insert", error.code);
        return false;
      }
      return true;
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
      if (error) {
        console.error("corrections insert", error.code);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error("analytics_v2 insert failed", e instanceof Error ? e.name : "error");
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const eventName = clipText(body.event_name, 64);
    if (!eventName || !isAllowedRecommendationLogEvent(eventName)) {
      return NextResponse.json({ ok: false, error: "invalid_event_type" }, { status: 400 });
    }
    const metadata = boundedRecord(body.metadata);
    if (!metadata) {
      return NextResponse.json({ ok: false, error: "invalid_event_data" }, { status: 400 });
    }
    const resolvedUserId = await getVerifiedUserId(req);
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
    }
    const skipEventsTable = shouldSkipRecommendationEventsTable(eventName);
    if (!skipEventsTable) {
      const row = {
        session_id: clipText(body.session_id, 128) ?? "unknown",
        user_id: resolvedUserId,
        event_name: eventName,
        entity_type: body.entity_type ?? null,
        entity_id: clipText(body.entity_id, 80),
        rank_position: body.recommendation_rank ?? null,
        scenario: clipText(body.scenario, 80),
        child_age_group: clipText(body.child_age_group, 40),
        weather_condition: clipText(body.weather_condition, 40),
        time_of_day: clipText(body.time_of_day, 40),
        date_time_band: clipText(body.date_time_band, 40),
        source_page: clipText(body.source_page, 80),
        created_at: body.created_at ?? new Date().toISOString(),
        template_id: clipText(body.template_id, 80),
        step_pattern: clipText(body.step_pattern, 80),
        place_ids: Array.isArray(body.place_ids) ? body.place_ids.slice(0, 30) : [],
        metadata: {
          ...metadata,
          place_snapshot: body.place_snapshot ?? null,
          course_snapshot: body.course_snapshot ?? null,
          recommendation_rank: body.recommendation_rank ?? null,
        },
      };
      const { error } = await supabase.from("recommendation_events").insert(row);
      if (error) {
        console.error("recommendation_events insert", error.code);
        return NextResponse.json({ ok: false, error: "event_write_failed" }, { status: 500 });
      }
    }

    const wrote = await insertAnalyticsV2({ ...body, event_name: eventName }, resolvedUserId);
    if (!wrote) {
      return NextResponse.json({ ok: false, error: "event_write_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("recommendation log", e instanceof Error ? e.name : "error");
    return NextResponse.json({ ok: false, error: "event_write_failed" }, { status: 500 });
  }
}
