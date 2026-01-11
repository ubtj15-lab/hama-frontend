// app/api/home-recommend/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calcDistanceKm } from "@/lib/geo";
import type { StoreRecord } from "@/lib/storeTypes";
import { mapStoreToHomeCard } from "@/lib/storeMappers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY! // 네 프로젝트가 이렇게 쓰고 있으면 유지
);

type TabKey = "all" | "restaurant" | "cafe" | "salon" | "activity";

const COUNT_BY_TAB: Record<TabKey, number> = {
  all: 12,
  restaurant: 3,
  cafe: 3,
  salon: 3,
  activity: 3,
};

// 배열 셔플
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const tab = (searchParams.get("tab") ?? "all") as TabKey;
  const limit = COUNT_BY_TAB[tab] ?? 12;

  const lat = Number(searchParams.get("lat") ?? "0");
  const lng = Number(searchParams.get("lng") ?? "0");
  const hasLoc = !!lat && !!lng;

  // 1) 먼저 넉넉히 가져와서(랜덤용) 탭별 필터 & 셔플
  //    850개면 전부 가져오면 비싸니까 200~300 정도만 샘플링
  //    (나중에 RPC/random 샘플링으로 최적화 가능)
  let q = supabase
    .from("stores")
    .select(
      "id,name,category,lat,lng,address,phone,image_url,is_active,mood,with_kids,for_work,price_level,tags"
    )
    .eq("is_active", true)
    .limit(300);

  if (tab !== "all") {
    q = q.eq("category", tab);
  }

  const { data, error } = await q;

  if (error || !data) {
    console.error("home-recommend error:", error);
    return NextResponse.json({ items: [], error: "failed_to_load" }, { status: 500 });
  }

  const stores = data as StoreRecord[];

  // 2) 랜덤 + limit
  const picked = shuffle(stores).slice(0, limit);

  // 3) 거리 계산 + 카드 변환
  const cards = picked.map((store) => {
    const distanceKm = hasLoc
      ? calcDistanceKm(lat, lng, store.lat, store.lng)
      : null;
    return mapStoreToHomeCard(store, distanceKm ?? undefined);
  });

  return NextResponse.json({ items: cards });
}
