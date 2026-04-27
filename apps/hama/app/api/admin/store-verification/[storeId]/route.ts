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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = [
    "solo_friendly",
    "group_seating",
    "private_room",
    "alcohol_available",
    "fast_food",
    "formal_atmosphere",
    "quick_service",
    "vegan_available",
    "halal_available",
    "with_kids",
    "max_group_size",
  ] as const;

  const capability: Record<string, unknown> = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      capability[k] = body[k];
    }
  }

  if (!Object.keys(capability).length) {
    return NextResponse.json({ error: "No capability fields provided" }, { status: 400 });
  }

  const patch = {
    ...capability,
    verified_by_human: true,
    verified_at: new Date().toISOString(),
    final_capability: capability,
  };

  const { data, error } = await supabase
    .from("stores")
    .update(patch)
    .eq("id", storeId)
    .select("id,name,verified_by_human,verified_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, store: data });
}
