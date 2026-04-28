import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

type PendingRow = {
  id: string;
  user_id: string;
  selected_place_id: string;
  receipt_place_name: string | null;
  receipt_image_url: string | null;
  created_at: string;
  status: "pending" | "approved" | "rejected";
  matched: boolean;
};

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "100");
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 100));

  try {
    const pendingQ = supabase
      .from("receipt_verifications")
      .select("id,user_id,selected_place_id,receipt_place_name,receipt_image_url,created_at,status,matched")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit);

    const rewardsQ = supabase
      .from("beta_user_state")
      .select("user_id,visit_count,is_rewarded,updated_at,last_visit_at")
      .or("is_rewarded.eq.true,visit_count.gte.3")
      .order("updated_at", { ascending: false })
      .limit(200);

    const [pendingRes, rewardsRes] = await Promise.all([pendingQ, rewardsQ]);
    if (pendingRes.error) {
      return NextResponse.json({ ok: false, error: "pending_read_failed", detail: pendingRes.error.message }, { status: 200 });
    }
    if (rewardsRes.error) {
      return NextResponse.json({ ok: false, error: "rewards_read_failed", detail: rewardsRes.error.message }, { status: 200 });
    }

    const pending = (pendingRes.data ?? []) as PendingRow[];
    const userIds = [...new Set(pending.map((p) => p.user_id))];

    const [statesRes, selectedLogsRes] = await Promise.all([
      userIds.length
        ? supabase.from("beta_user_state").select("user_id,visit_count,is_rewarded").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null } as { data: any[]; error: null }),
      pending.length
        ? supabase.from("selected_place_logs").select("user_id,place_id,place_name,created_at").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null } as { data: any[]; error: null }),
    ]);

    if (statesRes.error) {
      return NextResponse.json({ ok: false, error: "state_read_failed", detail: statesRes.error.message }, { status: 200 });
    }
    if (selectedLogsRes.error) {
      return NextResponse.json(
        { ok: false, error: "selected_logs_read_failed", detail: selectedLogsRes.error.message },
        { status: 200 }
      );
    }

    const stateMap = new Map<string, { visit_count: number; is_rewarded: boolean }>();
    for (const s of statesRes.data ?? []) {
      stateMap.set(String(s.user_id), {
        visit_count: Number(s.visit_count ?? 0),
        is_rewarded: s.is_rewarded === true,
      });
    }

    const selectedNameMap = new Map<string, string | null>();
    for (const p of pending) {
      const matchedLogs = (selectedLogsRes.data ?? [])
        .filter((l: any) => String(l.user_id) === p.user_id && String(l.place_id) === p.selected_place_id)
        .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
      selectedNameMap.set(p.id, matchedLogs[0]?.place_name ?? null);
    }

    const pendingWithSigned = await Promise.all(
      pending.map(async (p) => {
        let receiptImageSignedUrl: string | null = null;
        const receiptImagePath = p.receipt_image_url ?? null;
        if (receiptImagePath) {
          const signed = await supabase.storage.from("receipt-images").createSignedUrl(receiptImagePath, 60 * 60);
          if (!signed.error) receiptImageSignedUrl = signed.data?.signedUrl ?? null;
        }
        return {
          id: p.id,
          user_id: p.user_id,
          selected_place_id: p.selected_place_id,
          selected_place_name: selectedNameMap.get(p.id) ?? null,
          receipt_place_name: p.receipt_place_name ?? null,
          receipt_image_url: receiptImagePath,
          receipt_image_signed_url: receiptImageSignedUrl,
          created_at: p.created_at,
          matched: p.matched === true,
          status: p.status,
          visit_count: stateMap.get(p.user_id)?.visit_count ?? 0,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      pending: pendingWithSigned,
      reward_targets: (rewardsRes.data ?? []).map((r: any) => ({
        user_id: String(r.user_id),
        visit_count: Number(r.visit_count ?? 0),
        is_rewarded: r.is_rewarded === true,
        updated_at: r.updated_at ?? null,
        last_visit_at: r.last_visit_at ?? null,
      })),
    });
  } catch (e) {
    console.error("[admin beta-verifications] fatal", e);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
