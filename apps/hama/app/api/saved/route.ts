import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env
  .NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

/** GET: 저장 목록 */
export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get("user_id");

  if (!user_id) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ saved_ids: [] });
  }

  const { data, error } = await supabase
    .from("saved")
    .select("store_id")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("saved GET error:", error);
    return NextResponse.json({ saved_ids: [], stores: [] });
  }

  const saved_ids = (data ?? []).map((r) => r.store_id);
  if (saved_ids.length === 0) {
    return NextResponse.json({ saved_ids: [], stores: [] });
  }

  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("*")
    .in("id", saved_ids);

  if (storesError) {
    return NextResponse.json({ saved_ids, stores: [] });
  }

  const orderMap = new Map(saved_ids.map((id, i) => [id, i]));
  const sorted = (stores ?? []).sort(
    (a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999)
  );

  return NextResponse.json({ saved_ids, stores: sorted });
}

/** POST: 저장/해제 토글 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, store_id } = body as { user_id?: string; store_id?: string };

    if (!user_id || !store_id) {
      return NextResponse.json(
        { error: "user_id and store_id required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: true, saved: false });
    }

    const { data: existing } = await supabase
      .from("saved")
      .select("id")
      .eq("user_id", user_id)
      .eq("store_id", store_id)
      .single();

    if (existing) {
      await supabase
        .from("saved")
        .delete()
        .eq("user_id", user_id)
        .eq("store_id", store_id);
      return NextResponse.json({ ok: true, saved: false });
    }

    await supabase.from("saved").insert({ user_id, store_id });
    return NextResponse.json({ ok: true, saved: true });
  } catch (err) {
    console.error("saved POST error:", err);
    return NextResponse.json(
      { ok: false, error: "toggle failed" },
      { status: 500 }
    );
  }
}
