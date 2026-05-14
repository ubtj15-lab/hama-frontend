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

    if (action === "reject") {
      const nextStatus = "rejected";
      const update = await supabase
        .from("receipt_verifications")
        .update({ status: nextStatus, matched: false })
        .eq("id", verificationId);
      if (update.error) {
        return failJson("verification_update_failed", 500, update.error.message);
      }

      await supabase
        .from("user_place_photos")
        .update({ status: nextStatus })
        .eq("receipt_verification_id", verificationId);

      const state = await supabase
        .from("beta_user_state")
        .select("visit_count,is_rewarded")
        .eq("user_id", current.user_id)
        .maybeSingle();
      if (state.error) {
        return failJson("beta_state_read_failed", 500, state.error.message);
      }
      const visitCount = Number(state.data?.visit_count ?? 0);
      const isRewarded = state.data?.is_rewarded === true;

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

      return NextResponse.json({
        ok: true,
        success: true,
        verificationId,
        status: nextStatus,
        verification_id: verificationId,
        action,
        matched: false,
        visit_count: visitCount,
        is_rewarded: isRewarded,
        incremented: false,
        duplicate: false,
      });
    }

    // --- approve ---
    const existingApproved = await supabase
      .from("receipt_verifications")
      .select("id")
      .eq("user_id", current.user_id)
      .eq("selected_place_id", current.selected_place_id)
      .eq("status", "approved")
      .neq("id", verificationId)
      .maybeSingle();

    if (existingApproved.error) {
      return failJson("dedupe_check_failed", 500, existingApproved.error.message);
    }

    const existingApprovedId = existingApproved.data?.id ?? null;
    if (existingApprovedId) {
      const dupReason = "duplicate_approved_verification";
      const markDup = await supabase
        .from("receipt_verifications")
        .update({
          status: "duplicate",
          matched: false,
          rejection_reason: dupReason,
        })
        .eq("id", verificationId);
      if (markDup.error) {
        return failJson("verification_update_failed", 500, markDup.error.message);
      }

      await supabase
        .from("user_place_photos")
        .update({ status: "duplicate" })
        .eq("receipt_verification_id", verificationId);

      const stateDup = await supabase
        .from("beta_user_state")
        .select("visit_count,is_rewarded")
        .eq("user_id", current.user_id)
        .maybeSingle();
      if (stateDup.error) {
        return failJson("beta_state_read_failed", 500, stateDup.error.message);
      }
      const visitCountDup = Number(stateDup.data?.visit_count ?? 0);
      const isRewardedDup = stateDup.data?.is_rewarded === true;

      return NextResponse.json({
        ok: true,
        success: true,
        verificationId,
        status: "duplicate",
        verification_id: verificationId,
        action: "approve",
        matched: false,
        duplicate: true,
        existingApprovedId,
        visit_count: visitCountDup,
        is_rewarded: isRewardedDup,
        incremented: false,
      });
    }

    const nextStatus = "approved";
    const nextMatched = true;
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

    visitCount += 1;
    incremented = true;
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
      duplicate: false,
    });
  } catch {
    return failJson("unexpected_error", 500);
  }
}
