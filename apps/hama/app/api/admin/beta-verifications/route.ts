import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

type PendingRow = {
  id: string;
  user_id: string;
  selected_place_id: string;
  selected_place_log_id?: string | null;
  receipt_place_name: string | null;
  receipt_image_url: string | null;
  feedback_tags?: unknown;
  feedback_text?: string | null;
  created_at: string;
  status: "pending" | "approved" | "rejected";
  matched: boolean;
};

export async function GET(req: NextRequest) {
  console.log("[admin beta env check]", {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  let supabase: ReturnType<typeof createSupabaseAdmin>;
  try {
    supabase = createSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "env_missing", detail: e?.message ?? "Missing Supabase env" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "100");
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 100));

  try {
    const pendingQ = supabase
      .from("receipt_verifications")
      .select("*")
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
    const pendingErrorInfo = pendingRes.error
      ? {
          message: pendingRes.error.message,
          code: pendingRes.error.code,
          details: pendingRes.error.details,
          hint: pendingRes.error.hint,
        }
      : null;
    console.log("[admin pending raw result]", {
      pendingError: pendingRes.error?.message ?? null,
      pendingCount: pendingRes.data?.length,
      pendingFirst: pendingRes.data?.[0] ?? null,
    });
    if (pendingRes.error) {
      return NextResponse.json({ ok: false, error: "fetch_failed", detail: pendingRes.error.message }, { status: 500, headers: NO_STORE_HEADERS });
    }
    if (rewardsRes.error) {
      return NextResponse.json({ ok: false, error: "fetch_failed", detail: rewardsRes.error.message }, { status: 500, headers: NO_STORE_HEADERS });
    }

    const pendingRows = (pendingRes.data ?? []) as PendingRow[];
    const pending = pendingRows;
    const userIds = [...new Set(pending.map((p) => p.user_id).filter(Boolean))];
    const selectedPlaceIds = [...new Set(pending.map((p) => p.selected_place_id).filter(Boolean))];

    const [statesRes, selectedLogsRes] = await Promise.all([
      userIds.length
        ? supabase.from("beta_user_state").select("user_id,visit_count,is_rewarded").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null } as { data: any[]; error: null }),
      selectedPlaceIds.length
        ? supabase
            .from("selected_place_logs")
            .select("id,user_id,place_id,place_name,created_at")
            .in("place_id", selectedPlaceIds)
        : Promise.resolve({ data: [], error: null } as { data: any[]; error: null }),
    ]);

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
        .filter((l: any) => String(l.place_id) === String(p.selected_place_id))
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
          feedback_tags: Array.isArray(p.feedback_tags) ? p.feedback_tags : [],
          feedback_text: typeof p.feedback_text === "string" ? p.feedback_text : null,
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
      rewards: (rewardsRes.data ?? []).map((r: any) => ({
        user_id: String(r.user_id),
        visit_count: Number(r.visit_count ?? 0),
        is_rewarded: r.is_rewarded === true,
        updated_at: r.updated_at ?? null,
        last_visit_at: r.last_visit_at ?? null,
      })),
      reward_targets: (rewardsRes.data ?? []).map((r: any) => ({
        user_id: String(r.user_id),
        visit_count: Number(r.visit_count ?? 0),
        is_rewarded: r.is_rewarded === true,
        updated_at: r.updated_at ?? null,
        last_visit_at: r.last_visit_at ?? null,
      })),
      debug: {
        pendingRawCount: pendingRows.length,
        pendingStatuses:
          pendingRows?.map((row) => ({
            id: row.id,
            status: row.status,
            receipt_place_name: row.receipt_place_name,
          })) ?? [],
        pendingError: pendingErrorInfo,
        firstPending: pendingRows?.[0] ?? null,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        usedSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
        serviceKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 12) ?? null,
        selectedLogsError: selectedLogsRes.error?.message ?? null,
        betaStateError: statesRes.error?.message ?? null,
      },
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (e) {
    console.error("[admin beta-verifications] fatal", e);
    return NextResponse.json(
      { ok: false, error: "unexpected_error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  }
}
