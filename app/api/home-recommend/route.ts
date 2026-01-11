// app/api/home-recommend/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calcDistanceKm } from "@/lib/geo";
import { StoreRecord, mapStoreToHomeCard } from "@/lib/storeTypes";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // ✅ 보통 이 이름을 씀 (Vercel env에도 이렇게 넣어놨을 확률이 높음)
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const lat = Number(searchParams.get("lat") ?? "0");
  const lng = Number(searchParams.get("lng") ?? "0");

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("is_active", true)
    .limit(200);

  if (error || !data) {
    console.error("home-recommend error:", error);
    return NextResponse.json(
      { items: [], error: "failed_to_load" },
      { status: 500 }
    );
  }

  const stores = data as StoreRecord[];

  const cards = stores
    .map((store) => {
      const d =
        lat && lng ? calcDistanceKm(lat, lng, store.lat, store.lng) : 0;
      return mapStoreToHomeCard(store, d);
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return NextResponse.json({ items: cards });
}
