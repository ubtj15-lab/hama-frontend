import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

type Body = {
  action?: "approve" | "reject";
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ verificationId: string }> }
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }
  const { verificationId } = await params;
  if (!verificationId) {
    return NextResponse.json({ ok: false, error: "verification_id_required" }, { status: 400 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }

  try {
    const target = await supabase
      .from("receipt_verifications")
      .select("id,user_id,selected_place_id,status,matched")
      .eq("id", verificationId)
      .maybeSingle();
    if (target.error) {
      return NextResponse.json({ ok: false, error: "verification_read_failed", detail: target.error.message }, { status: 200 });
    }
    if (!target.data) {
      return NextResponse.json({ ok: false, error: "verification_not_found" }, { status: 404 });
    }

    const current = target.data;
    const nextStatus = action === "approve" ? "approved" : "rejected";
    const nextMatched = action === "approve";
    const update = await supabase
      .from("receipt_verifications")
      .update({ status: nextStatus, matched: nextMatched })
      .eq("id", verificationId);
    if (update.error) {
      return NextResponse.json({ ok: false, error: "verification_update_failed", detail: update.error.message }, { status: 200 });
    }

    let visitCount = 0;
    let isRewarded = false;
    let incremented = false;

    const state = await supabase
      .from("beta_user_state")
      .select("visit_count,is_rewarded")
      .eq("user_id", current.user_id)
      .maybeSingle();
    if (state.error) {
      return NextResponse.json({ ok: false, error: "beta_state_read_failed", detail: state.error.message }, { status: 200 });
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
        return NextResponse.json({ ok: false, error: "dedupe_check_failed", detail: dup.error.message }, { status: 200 });
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
        return NextResponse.json({ ok: false, error: "beta_state_upsert_failed", detail: upsert.error.message }, { status: 200 });
      }
      console.log("admin_receipt_approved", {
        verification_id: verificationId,
        user_id: current.user_id,
        selected_place_id: current.selected_place_id,
        visit_count: visitCount,
        incremented,
      });
      if (isRewarded) {
        console.log("beta_reward_completed", { user_id: current.user_id, visit_count: visitCount });
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
        return NextResponse.json({ ok: false, error: "beta_state_keep_failed", detail: upsert.error.message }, { status: 200 });
      }
      console.log("admin_receipt_rejected", {
        verification_id: verificationId,
        user_id: current.user_id,
        selected_place_id: current.selected_place_id,
      });
    }

    return NextResponse.json({
      ok: true,
      verification_id: verificationId,
      action,
      status: nextStatus,
      matched: nextMatched,
      visit_count: visitCount,
      is_rewarded: isRewarded,
      incremented,
    });
  } catch (e) {
    console.error("[admin beta-verification patch] fatal", e);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
