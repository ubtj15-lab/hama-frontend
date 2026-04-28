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
  user_id?: string | null;
  place_id?: string;
  place_name?: string | null;
  source?: string | null;
  satisfaction?: "good" | "neutral" | "bad";
  feedback_tags?: string[] | null;
  memo?: string | null;
};

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    console.error("[visit-feedback] invalid_json");
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  console.log("[visit-feedback] body:", body);

  const userId = await resolveUserId(req, supabase, body.user_id ?? null);
  if (!userId) {
    console.error("[visit-feedback] unauthorized: no user_id resolved", {
      incoming_user_id: body.user_id ?? null,
      has_cookie_user_id: Boolean(req.cookies.get("hama_user_id")?.value),
      has_cookie_kakao_id: Boolean(req.cookies.get("hama_kakao_id")?.value),
    });
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const placeId = String(body.place_id ?? "").trim();
  if (!placeId) {
    console.error("[visit-feedback] place_id_required", { body });
    return NextResponse.json({ ok: false, error: "place_id_required" }, { status: 400 });
  }

  if (!body.satisfaction || !["good", "neutral", "bad"].includes(body.satisfaction)) {
    console.error("[visit-feedback] invalid_satisfaction", {
      satisfaction: body.satisfaction ?? null,
      place_id: placeId,
      user_id: userId,
    });
    return NextResponse.json({ ok: false, error: "invalid_satisfaction" }, { status: 400 });
  }

  try {
    const normalizedTags = Array.isArray(body.feedback_tags)
      ? body.feedback_tags.filter((x): x is string => typeof x === "string")
      : [];
    const normalizedMemo =
      typeof body.memo === "string" && body.memo.trim().length > 0 ? body.memo.trim() : null;

    const row = {
      user_id: userId,
      place_id: placeId,
      place_name: body.place_name ?? null,
      source: body.source ?? "hama_pay",
      satisfaction: body.satisfaction,
      feedback_tags: normalizedTags,
      memo: normalizedMemo,
    };
    console.log("[visit-feedback] normalized row:", row);
    const { data, error } = await supabase.from("visit_feedback").insert(row).select("id").single();
    if (error) {
      console.error("[visit-feedback] insert failed:", {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        row,
      });
      return NextResponse.json({ ok: false, error: "insert_failed", detail: error.message }, { status: 200 });
    }
    console.log("visit_feedback_saved", {
      visit_feedback_id: data?.id ?? null,
      user_id: userId,
      place_id: placeId,
      place_name: body.place_name ?? null,
      satisfaction: body.satisfaction,
      feedback_tags: normalizedTags,
      memo: normalizedMemo,
      source: body.source ?? "hama_pay",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[visit-feedback] fatal:", e, { body, user_id: userId, place_id: placeId });
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
