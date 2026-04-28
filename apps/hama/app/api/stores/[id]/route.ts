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

export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });

  const id = decodeURIComponent(String(context.params.id ?? "")).trim();
  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });

  try {
    const { data, error } = await supabase.from("stores").select("*").eq("id", id).maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, item: data });
  } catch (e) {
    console.error("[store detail by id] failed:", e);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
