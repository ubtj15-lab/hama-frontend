import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { resolveUserIdFromRequest } from "@/lib/server/userResolver";

type Body = {
  user_id?: string | null;
  selected_place_log_id?: string | null;
  receipt_place_name?: string | null;
  receipt_image_url?: string | null;
};

function normalizeName(v: string | null | undefined): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function namesMatched(selectedName: string | null | undefined, receiptName: string | null | undefined) {
  const a = normalizeName(selectedName);
  const b = normalizeName(receiptName);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

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

  const receiptPlaceName = String(body.receipt_place_name ?? "").trim();
  if (!receiptPlaceName) {
    return NextResponse.json({ ok: false, error: "receipt_place_name_required" }, { status: 400 });
  }

  try {
    const selectedPlaceLogId = String(body.selected_place_log_id ?? "").trim();
    if (!selectedPlaceLogId) {
      return NextResponse.json({ ok: false, error: "selected_place_log_id_required" }, { status: 400 });
    }

    const selectedDecision = await supabase
      .from("selected_place_logs")
      .select("id,place_id,place_name,created_at")
      .eq("user_id", userId)
      .eq("id", selectedPlaceLogId)
      .maybeSingle();

    if (selectedDecision.error) {
      return NextResponse.json(
        { ok: false, error: "selected_place_read_failed", detail: selectedDecision.error.message },
        { status: 200 }
      );
    }
    if (!selectedDecision.data) {
      return NextResponse.json({ ok: false, error: "selected_place_not_found" }, { status: 200 });
    }

    const selected = selectedDecision.data;
    const matched = namesMatched(selected.place_name, receiptPlaceName);
    const status = "pending";

    const inserted = await supabase.from("receipt_verifications").insert({
      user_id: userId,
      selected_place_id: selected.place_id,
      receipt_image_url: body.receipt_image_url ?? null,
      receipt_place_name: receiptPlaceName,
      matched,
      status,
    });
    if (inserted.error) {
      return NextResponse.json(
        { ok: false, error: "receipt_verification_insert_failed", detail: inserted.error.message },
        { status: 200 }
      );
    }

    console.log("receipt_verification_submitted", {
      selected_place_id: selected.place_id,
      selected_place_log_id: selectedPlaceLogId,
      selected_place_name: selected.place_name,
      receipt_place_name: receiptPlaceName,
      matched,
      status,
    });

    return NextResponse.json({
      ok: true,
      status,
      matched,
      selected_place: selected,
      selected_place_log_id: selectedPlaceLogId,
      message: "인증이 제출됐어요. 관리자가 확인 후 참여 횟수에 반영돼요.",
    });
  } catch (e) {
    console.error("[beta receipt verify] fatal", e);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
