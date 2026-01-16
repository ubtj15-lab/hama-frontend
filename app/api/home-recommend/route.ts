// app/api/home-recommend/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { calcDistanceKm } from "@/lib/geo";
import type { HomeTabKey, StoreRecord } from "@/lib/storeTypes";
import { mapStoreToHomeCard } from "@/lib/storeMappers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function pickRandom<T>(arr: T[], n: number) {
  if (arr.length <= n) return arr;
  const copy = [...arr];

  // Fisher–Yates shuffle
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy.slice(0, n);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const tab = (searchParams.get("tab") ?? "all") as HomeTabKey;
  const lat = Number(searchParams.get("lat") ?? "0");
  const lng = Number(searchParams.get("lng") ?? "0");
  const count = Math.max(1, Number(searchParams.get("count") ?? "12"));

  const { data, error } = await supabase
    .from("stores")
    .select(
      "id,name,category,area,address,lat,lng,phone,image_url,distance_hint,is_active,mood,with_kids,for_work,price_level,tags"
    )
    .eq("is_active", true)
    .limit(500);

  if (error || !data) {
    console.error("home-recommend error:", error);
    return NextResponse.json(
      { items: [], error: "failed_to_load" },
      { status: 500 }
    );
  }

  let stores = data as StoreRecord[];

  // 탭 필터
  if (tab !== "all") {
    stores = stores.filter((s) => s.category === tab);
  }

  // 랜덤 픽
  const picked = pickRandom(stores, count);

  // 거리 계산 + 카드 변환 + 가까운 순 정렬
  const cards = picked
    .map((store) => {
      const d =
        lat && lng && store.lat != null && store.lng != null
          ? calcDistanceKm(lat, lng, store.lat, store.lng)
          : 0;
      return mapStoreToHomeCard(store, d);
    })
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

  return NextResponse.json({ items: cards });
}
