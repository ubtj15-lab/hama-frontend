import { NextRequest, NextResponse } from "next/server";
import { storeRowMatchesServiceRegion } from "@/lib/serviceRegion";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getVerifiedUserId } from "@/lib/server/verifiedSession";

export const dynamic = "force-dynamic";

/** GET: 검증된 세션 사용자의 저장 목록 */
export async function GET(req: NextRequest) {
  const userId = await getVerifiedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("saved")
    .select("store_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("saved GET error", error.code, error.message);
    return NextResponse.json({ error: "saved_read_failed" }, { status: 500 });
  }

  const savedIds = (data ?? []).map((row) => row.store_id).filter(Boolean);
  if (savedIds.length === 0) {
    return NextResponse.json({ saved_ids: [], stores: [] });
  }

  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("*")
    .in("id", savedIds);

  if (storesError) {
    console.error("saved stores error", storesError.code, storesError.message);
    return NextResponse.json({ error: "stores_read_failed" }, { status: 500 });
  }

  const orderMap = new Map(savedIds.map((id, index) => [id, index]));
  const sorted = (stores ?? [])
    .filter(storeRowMatchesServiceRegion)
    .sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));

  return NextResponse.json({ saved_ids: sorted.map((store) => store.id), stores: sorted });
}

/** POST: 검증된 세션 사용자의 저장 토글. 본문의 user_id는 무시한다. */
export async function POST(req: NextRequest) {
  const userId = await getVerifiedUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let storeId = "";
  try {
    const body = (await req.json()) as { store_id?: string };
    storeId = String(body.store_id ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!storeId) {
    return NextResponse.json({ ok: false, error: "store_id required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("saved")
    .select("id")
    .eq("user_id", userId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (existingError) {
    console.error("saved lookup error", existingError.code, existingError.message);
    return NextResponse.json({ ok: false, error: "saved_read_failed" }, { status: 500 });
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("saved")
      .delete()
      .eq("user_id", userId)
      .eq("store_id", storeId);
    if (deleteError) {
      console.error("saved delete error", deleteError.code, deleteError.message);
      return NextResponse.json({ ok: false, error: "saved_delete_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, saved: false });
  }

  const { error: insertError } = await supabase.from("saved").insert({
    user_id: userId,
    store_id: storeId,
  });
  if (insertError) {
    console.error("saved insert error", insertError.code, insertError.message);
    return NextResponse.json({ ok: false, error: "saved_write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: true });
}
