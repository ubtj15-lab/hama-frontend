// app/api/stores/home/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { StoreRecord } from "../../../lib/storeTypes";
import { storeRowMatchesServiceRegion } from "../../../lib/serviceRegion";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(url, key);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("is_active", true)
      .limit(20);

    if (error) {
      return NextResponse.json({ items: [], error: error.message }, { status: 500 });
    }

    const items = ((data ?? []) as StoreRecord[]).filter(storeRowMatchesServiceRegion);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [], error: "unknown" }, { status: 500 });
  }
}
