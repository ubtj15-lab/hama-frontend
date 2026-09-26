import { NextRequest, NextResponse } from "next/server";
import { storeRowMatchesServiceRegion } from "@/lib/serviceRegion";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getVerifiedUserId } from "@/lib/server/verifiedSession";

export const dynamic = "force-dynamic";

/** GET: 검증된 세션 사용자의 최근 본 목록 */
export async function GET(req: NextRequest) {
  const userId = await getVerifiedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 20, 50);
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 500 });
  }

  const { data: views, error } = await supabase
    .from("recent_views")
    .select("store_id, viewed_at")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("recent GET error", error.code, error.message);
    return NextResponse.json({ error: "recent_read_failed" }, { status: 500 });
  }

  const storeIds = (views ?? []).map((view) => view.store_id).filter(Boolean);
  if (storeIds.length === 0) {
    return NextResponse.json({ store_ids: [], stores: [] });
  }

  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("*")
    .in("id", storeIds);

  if (storesError) {
    console.error("recent stores error", storesError.code, storesError.message);
    return NextResponse.json({ error: "stores_read_failed" }, { status: 500 });
  }

  const orderMap = new Map(storeIds.map((id, index) => [id, index]));
  const sorted = (stores ?? [])
    .filter(storeRowMatchesServiceRegion)
    .sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));

  return NextResponse.json({ store_ids: sorted.map((store) => store.id), stores: sorted });
}
