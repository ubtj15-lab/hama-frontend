import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

type Body = {
  action?: "approve" | "reject";
};

function failJson(
  error: string,
  status: number,
  detail?: string
): NextResponse<{ ok: false; success: false; error: string; details?: string }> {
  const body: { ok: false; success: false; error: string; details?: string } = {
    ok: false,
    success: false,
    error,
  };
  if (detail) body.details = detail;
  return NextResponse.json(body, { status });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ verificationId: string }> }
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return failJson("supabase_unavailable", 500);
  }
  const { verificationId } = await params;
  if (!verificationId) {
    return failJson("verification_id_required", 400);
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return failJson("invalid_json", 400);
  }
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return failJson("invalid_action", 400);
  }

  try {
    const target = await supabase
      .from("receipt_verifications")
      .select("id,user_id,selected_place_id,status,matched")
      .eq("id", verificationId)
      .maybeSingle();
    if (target.error) {
      return failJson("verification_read_failed", 500, target.error.message);
    }
    if (!target.data) {
      return failJson("verification_not_found", 404);
    }

    const current = target.data;
    const nextStatus = action === "approve" ? "approved" : "rejected";
    const nextMatched = action === "approve";
    const update = await supabase
      .from("receipt_verifications")
      .update({ status: nextStatus, matched: nextMatched })
      .eq("id", verificationId);
    if (update.error) {
      return failJson("verification_update_failed", 500, update.error.message);
    }

    await supabase
      .from("user_place_photos")
      .update({ status: nextStatus })
      .eq("receipt_verification_id", verificationId);

    let visitCount = 0;
    let isRewarded = false;
    let incremented = false;

    const state = await supabase
      .from("beta_user_state")
      .select("visit_count,is_rewarded")
      .eq("user_id", current.user_id)
      .maybeSingle();
    if (state.error) {
      return failJson("beta_state_read_failed", 500, state.error.message);
    }

    visitCount = Number(state.data?.visit_count ?? 0);
    isRewarded = state.data?.is_rewarded === true;

    if (action === "approve") {
      // 중복 카운트 방어: 동일 user_id + selected_place_id 승인 이력(본건 제외) 있으면 미증가
      const dup = await supabase
        .from("receipt_verifications")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", current.user_id)
        .eq("selected_place_id", current.selected_place_id)
        .eq("status", "approved")
        .neq("id", verificationId);

      if (dup.error) {
        return failJson("dedupe_check_failed", 500, dup.error.message);
      }
      const alreadyApproved = (dup.count ?? 0) > 0;
      if (!alreadyApproved) {
        visitCount += 1;
        incremented = true;
      }
      if (visitCount >= 3) isRewarded = true;

      const upsert = await supabase.from("beta_user_state").upsert(
        {
          user_id: current.user_id,
          visit_count: visitCount,
          is_rewarded: isRewarded,
          last_visit_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (upsert.error) {
        return failJson("beta_state_upsert_failed", 500, upsert.error.message);
      }
    } else {
      // reject 시에는 카운트 변경 없음
      const upsert = await supabase.from("beta_user_state").upsert(
        {
          user_id: current.user_id,
          visit_count: visitCount,
          is_rewarded: isRewarded,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (upsert.error) {
        return failJson("beta_state_keep_failed", 500, upsert.error.message);
      }
    }

    return NextResponse.json({
      ok: true,
      success: true,
      verificationId,
      status: nextStatus,
      verification_id: verificationId,
      action,
      matched: nextMatched,
      visit_count: visitCount,
      is_rewarded: isRewarded,
      incremented,
    });
  } catch {
    return failJson("unexpected_error", 500);
  }
}
