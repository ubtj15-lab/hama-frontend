// app/api/home-recommend/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calcDistanceKm } from "@/lib/geo";
import {
  StoreRecord,
  mapStoreToHomeCard,
} from "@/lib/storeTypes";

// Supabase 클라이언트 (이미 따로 파일 있으면 그거 import 해도 됨)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // lat / lng 없으면 그냥 0,0 기준으로 두고 "거리 0km" 느낌으로만
  const lat = Number(searchParams.get("lat") ?? "0");
  const lng = Number(searchParams.get("lng") ?? "0");

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("is_active", true)
    .limit(50);

  if (error || !data) {
    console.error("home-recommend error:", error);
    return NextResponse.json(
      { items: [], error: "failed_to_load" },
      { status: 500 }
    );
  }

  const stores = data as StoreRecord[];

  // 거리 계산 + 카드 변환
  const cards = stores
    .map((store) => {
      const distanceKm =
        lat && lng ? calcDistanceKm(lat, lng, store.lat, store.lng) : 0;
      return mapStoreToHomeCard(store, distanceKm);
    })
    // 가까운 순으로 정렬
    .sort((a, b) => a.distanceKm - b.distanceKm)
    // 상위 5개만
    .slice(0, 5);

  return NextResponse.json({ items: cards });
}
