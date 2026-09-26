import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforceAdmin, isSafeResourceId, parseStoreCapabilityBody } from "@/lib/server/adminAccess";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as
    | string
    | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const denied = await enforceAdmin(req, { mutate: true });
  if (denied) return denied;

  const { storeId } = await params;
  if (!storeId || !isSafeResourceId(storeId)) {
    return NextResponse.json({ error: "storeId required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update = parseStoreCapabilityBody(body);
  if (!update) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  try {
    const { data, error } = await supabase
      .from("stores")
      .update(update)
      .eq("id", storeId)
      .select("id,name")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, store: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to update" }, { status: 500 });
  }
}
