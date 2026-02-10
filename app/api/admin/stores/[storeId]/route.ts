import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as
    | string
    | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * PATCH /api/admin/stores/[storeId]
 * body: { owner_id: string | null }
 * 관리자용: 매장 owner_id 설정
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const { storeId } = await params;
  if (!storeId) {
    return NextResponse.json({ error: "storeId required" }, { status: 400 });
  }

  let body: { owner_id?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const owner_id = body.owner_id === undefined ? undefined : body.owner_id === null ? null : String(body.owner_id);

  try {
    const { data, error } = await supabase
      .from("stores")
      .update({ owner_id: owner_id ?? null })
      .eq("id", storeId)
      .select("id, name, owner_id")
      .single();

    if (error) {
      console.error("[admin/stores PATCH]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, store: data });
  } catch (err) {
    console.error("[admin/stores PATCH]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
