import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env
  .NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

/** GET: 최근 본 목록 (user_id 필수) */
export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get("user_id");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 20, 50);

  if (!user_id) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const { data: views, error } = await supabase
    .from("recent_views")
    .select("store_id, viewed_at")
    .eq("user_id", user_id)
    .order("viewed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("recent GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const storeIds = (views ?? []).map((v) => v.store_id);
  if (storeIds.length === 0) {
    return NextResponse.json({ store_ids: [], stores: [] });
  }

  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("*")
    .in("id", storeIds);

  if (storesError) {
    console.error("recent stores fetch error:", storesError);
    return NextResponse.json({ store_ids: storeIds, stores: [] });
  }

  const orderMap = new Map(storeIds.map((id, i) => [id, i]));
  const sorted = (stores ?? []).sort(
    (a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999)
  );

  return NextResponse.json({ store_ids: storeIds, stores: sorted });
}
