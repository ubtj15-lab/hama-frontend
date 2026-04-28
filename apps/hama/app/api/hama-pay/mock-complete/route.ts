import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildVisitVerificationContext } from "@/lib/visitVerification";

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

function dayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

async function incrementBetaVisitCountOncePerDay(
  supabase: ReturnType<typeof getSupabase>,
  userId: string,
  placeId: string
): Promise<{ incremented: boolean; reason?: string }> {
  if (!supabase) return { incremented: false, reason: "supabase_unavailable" };
  const { startIso, endIso } = dayRange();
  try {
    const dup = await supabase
      .from("hama_pay_transactions")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", userId)
      .eq("place_id", placeId)
      .gte("created_at", startIso)
      .lt("created_at", endIso);

    if (dup.error) return { incremented: false, reason: "dedupe_query_failed" };
    if ((dup.count ?? 0) > 1) return { incremented: false, reason: "already_counted_today" };

    const current = await supabase
      .from("beta_user_state")
      .select("visit_count")
      .eq("user_id", userId)
      .maybeSingle();

    if (current.error) return { incremented: false, reason: "beta_state_select_failed" };
    const nextCount = Number(current.data?.visit_count ?? 0) + 1;

    const upsertA = await supabase.from("beta_user_state").upsert(
      {
        user_id: userId,
        visit_count: nextCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (!upsertA.error) return { incremented: true };

    const upsertB = await supabase
      .from("beta_user_state")
      .upsert({ user_id: userId, visit_count: nextCount }, { onConflict: "user_id" });
    if (!upsertB.error) return { incremented: true };

    return { incremented: false, reason: "beta_state_upsert_failed" };
  } catch {
    return { incremented: false, reason: "beta_state_exception" };
  }
}

type Body = {
  user_id?: string | null;
  place_id?: string;
  place_name?: string | null;
  amount?: number | null;
  context_json?: Record<string, unknown> | null;
};

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const userId = await resolveUserId(req, supabase, body.user_id ?? null);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const placeId = String(body.place_id ?? "").trim();
  if (!placeId) {
    return NextResponse.json({ ok: false, error: "place_id_required" }, { status: 400 });
  }

  const contextJson = buildVisitVerificationContext({
    track: "hama_pay",
    placeId,
    sourcePage: typeof body.context_json?.source_page === "string" ? body.context_json.source_page : "results",
    meta: body.context_json ?? {},
  });

  try {
    const { error } = await supabase.from("hama_pay_transactions").insert({
      user_id: userId,
      place_id: placeId,
      place_name: body.place_name ?? null,
      amount: typeof body.amount === "number" ? body.amount : null,
      payment_method: "hama_pay_mock",
      status: "completed",
      context_json: contextJson,
    });

    if (error) {
      console.error("[hama-pay mock] insert failed:", error.message);
      return NextResponse.json(
        { ok: false, error: "transaction_insert_failed", detail: error.message },
        { status: 200 }
      );
    }

    const betaVisit = await incrementBetaVisitCountOncePerDay(supabase, userId, placeId);
    return NextResponse.json({ ok: true, verification_track: "hama_pay", beta_visit: betaVisit });
  } catch (e) {
    console.error("[hama-pay mock] fatal:", e);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
