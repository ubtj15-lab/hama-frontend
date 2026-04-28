import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { resolveUserIdFromRequest } from "@/lib/server/userResolver";

type Body = {
  user_id?: string | null;
  place_id?: string | null;
  place_name?: string | null;
  recommendation_id?: string | null;
  context_json?: Record<string, unknown> | null;
};

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const userId = await resolveUserIdFromRequest(req, body.user_id ?? null);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const placeId = String(body.place_id ?? "").trim();
  if (!placeId) {
    return NextResponse.json({ ok: false, error: "place_id_required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("selected_place_logs")
      .insert({
        user_id: userId,
        place_id: placeId,
        place_name: body.place_name ?? null,
        recommendation_id: body.recommendation_id ?? null,
        context_json: body.context_json ?? {},
      })
      .select("id")
      .single();
    if (error) {
      console.error("[beta decision] insert failed", error.message);
      return NextResponse.json(
        { ok: false, error: "selected_place_log_insert_failed", detail: error.message },
        { status: 200 }
      );
    }
    return NextResponse.json({
      ok: true,
      selected_place_log_id: data?.id ?? null,
      selectedPlaceLogId: data?.id ?? null,
    });
  } catch (e) {
    console.error("[beta decision] fatal", e);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
