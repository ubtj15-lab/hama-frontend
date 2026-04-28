import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { resolveUserIdFromRequest } from "@/lib/server/userResolver";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }
  const userId = await resolveUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const [{ data: betaState, error: betaError }, { data: latestDecision, error: decisionError }] = await Promise.all([
      supabase
        .from("beta_user_state")
        .select("visit_count,is_rewarded,last_visit_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("selected_place_logs")
        .select("id,place_id,place_name,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (betaError) {
      return NextResponse.json({ ok: false, error: "beta_state_read_failed", detail: betaError.message }, { status: 200 });
    }
    if (decisionError) {
      return NextResponse.json(
        { ok: false, error: "selected_place_read_failed", detail: decisionError.message },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      visit_count: Number(betaState?.visit_count ?? 0),
      is_rewarded: betaState?.is_rewarded === true,
      last_visit_at: betaState?.last_visit_at ?? null,
      latest_selected_place: latestDecision ?? null,
    });
  } catch (e) {
    console.error("[beta state] fatal", e);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
