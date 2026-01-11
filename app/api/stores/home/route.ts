// app/api/stores/home/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { StoreRecord, mapStoreToHomeCard } from "@/lib/storeTypes";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from<StoreRecord>("stores")
      .select("*")
      .eq("is_active", true)
      .limit(20);

    if (error) {
      console.error("[/api/stores/home] supabase error", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const records = data ?? [];
    const cards = records.map(mapStoreToHomeCard);

    return NextResponse.json({ ok: true, items: cards });
  } catch (err: any) {
    console.error("[/api/stores/home] unknown error", err);
    return NextResponse.json(
      { ok: false, error: "unknown_error" },
      { status: 500 }
    );
  }
}
