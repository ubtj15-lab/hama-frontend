// app/api/stores/home/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { StoreRecord } from "../../../lib/storeTypes";

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const supabase = makeSupabase();
    if (!supabase) {
      return NextResponse.json(
        { items: [], error: "Missing SUPABASE env" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("is_active", true)
      .limit(20);

    if (error) {
      return NextResponse.json({ items: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: (data ?? []) as StoreRecord[] });
  } catch (e) {
    return NextResponse.json({ items: [], error: "unknown" }, { status: 500 });
  }
}
