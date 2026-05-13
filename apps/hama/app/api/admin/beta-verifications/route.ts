import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { VISIT_PLACE_PHOTO_BUCKET } from "@/lib/server/visitPlacePhotoUpload";

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

type VisitPhotoRow = {
  id: string;
  user_id: string;
  store_id: string | null;
  store_name: string | null;
  photo_storage_path: string;
  visit_feedback_id: string | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  let supabase: ReturnType<typeof createSupabaseAdmin>;
  try {
    supabase = createSupabaseAdmin();
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : "Missing Supabase env";
    return NextResponse.json({ ok: false, error: "env_missing", detail }, { status: 500, headers: NO_STORE_HEADERS });
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

    const feedbackPhotosQ = supabase
      .from("user_place_photos")
      .select("id,user_id,store_id,store_name,photo_storage_path,visit_feedback_id,created_at")
      .eq("status", "pending")
      .eq("source", "visit_feedback")
      .is("receipt_verification_id", null)
      .order("created_at", { ascending: false })
      .limit(120);

    const [pendingRes, rewardsRes, feedbackPhotosRes] = await Promise.all([
      pendingQ,
      rewardsQ,
      feedbackPhotosQ,
    ]);

    if (pendingRes.error) {
      return NextResponse.json(
        { ok: false, error: "fetch_failed", detail: pendingRes.error.message },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
    if (rewardsRes.error) {
      return NextResponse.json(
        { ok: false, error: "fetch_failed", detail: rewardsRes.error.message },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const pendingRows = (pendingRes.data ?? []) as PendingRow[];
    const pending = pendingRows;
    const userIds = [...new Set(pending.map((p) => p.user_id).filter(Boolean))];
    const selectedPlaceIds = [...new Set(pending.map((p) => p.selected_place_id).filter(Boolean))];

    const [statesRes, selectedLogsRes] = await Promise.all([
      userIds.length
        ? supabase.from("beta_user_state").select("user_id,visit_count,is_rewarded").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null } as { data: { user_id: string; visit_count: number; is_rewarded: boolean }[]; error: null }),
      selectedPlaceIds.length
        ? supabase
            .from("selected_place_logs")
            .select("id,user_id,place_id,place_name,created_at")
            .in("place_id", selectedPlaceIds)
        : Promise.resolve({ data: [], error: null } as { data: { id: string; user_id: string; place_id: string; place_name: string | null; created_at: string }[]; error: null }),
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
        .filter((l) => String(l.place_id) === String(p.selected_place_id))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      selectedNameMap.set(p.id, matchedLogs[0]?.place_name ?? null);
    }

    const pendingIds = pending.map((p) => p.id);
    const receiptPhotosRes =
      pendingIds.length > 0
        ? await supabase
            .from("user_place_photos")
            .select("id,receipt_verification_id,photo_storage_path,status")
            .in("receipt_verification_id", pendingIds)
            .eq("status", "pending")
        : { data: [] as { id: string; receipt_verification_id: string; photo_storage_path: string }[], error: null };

    const visitPhotosByReceipt = new Map<
      string,
      { id: string; photo_storage_path: string; visit_photo_signed_url: string | null }[]
    >();
    if (!receiptPhotosRes.error && receiptPhotosRes.data) {
      for (const row of receiptPhotosRes.data) {
        const rid = String(row.receipt_verification_id ?? "");
        if (!rid) continue;
        let visitPhotoSignedUrl: string | null = null;
        const path = row.photo_storage_path;
        if (path) {
          const signed = await supabase.storage
            .from(VISIT_PLACE_PHOTO_BUCKET)
            .createSignedUrl(path, 60 * 60);
          if (!signed.error) visitPhotoSignedUrl = signed.data?.signedUrl ?? null;
        }
        const list = visitPhotosByReceipt.get(rid) ?? [];
        list.push({
          id: String(row.id),
          photo_storage_path: path,
          visit_photo_signed_url: visitPhotoSignedUrl,
        });
        visitPhotosByReceipt.set(rid, list);
      }
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
          visit_place_photos: visitPhotosByReceipt.get(p.id) ?? [],
          feedback_tags: Array.isArray(p.feedback_tags) ? p.feedback_tags : [],
          feedback_text: typeof p.feedback_text === "string" ? p.feedback_text : null,
          created_at: p.created_at,
          matched: p.matched === true,
          status: p.status,
          visit_count: stateMap.get(p.user_id)?.visit_count ?? 0,
        };
      })
    );

    const feedbackPhotoRows = feedbackPhotosRes.error
      ? []
      : ((feedbackPhotosRes.data ?? []) as VisitPhotoRow[]);
    const feedbackVisitPhotosWithSigned = await Promise.all(
      feedbackPhotoRows.map(async (row) => {
        let signedUrl: string | null = null;
        if (row.photo_storage_path) {
          const signed = await supabase.storage
            .from(VISIT_PLACE_PHOTO_BUCKET)
            .createSignedUrl(row.photo_storage_path, 60 * 60);
          if (!signed.error) signedUrl = signed.data?.signedUrl ?? null;
        }
        return {
          id: row.id,
          user_id: row.user_id,
          store_id: row.store_id,
          store_name: row.store_name,
          visit_feedback_id: row.visit_feedback_id,
          created_at: row.created_at,
          visit_photo_signed_url: signedUrl,
        };
      })
    );

    return NextResponse.json(
      {
        ok: true,
        pending: pendingWithSigned,
        feedback_only_visit_photos: feedbackVisitPhotosWithSigned,
        rewards: (rewardsRes.data ?? []).map((r: { user_id: string; visit_count: number; is_rewarded: boolean; updated_at?: string; last_visit_at?: string }) => ({
          user_id: String(r.user_id),
          visit_count: Number(r.visit_count ?? 0),
          is_rewarded: r.is_rewarded === true,
          updated_at: r.updated_at ?? null,
          last_visit_at: r.last_visit_at ?? null,
        })),
        reward_targets: (rewardsRes.data ?? []).map((r: { user_id: string; visit_count: number; is_rewarded: boolean; updated_at?: string; last_visit_at?: string }) => ({
          user_id: String(r.user_id),
          visit_count: Number(r.visit_count ?? 0),
          is_rewarded: r.is_rewarded === true,
          updated_at: r.updated_at ?? null,
          last_visit_at: r.last_visit_at ?? null,
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch {
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
