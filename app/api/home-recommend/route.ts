// app/api/home-recommend/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mapStoreToHomeCard, type StoreRecord } from "@/lib/storeTypes";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Fisher–Yates shuffle (진짜 랜덤 셔플)
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

  // tab = all | restaurant | cafe | salon | activity
  const tab = (searchParams.get("tab") ?? "all").toLowerCase();

  // 개수: 종합 12개, 나머지 탭 3개
  const limit = tab === "all" ? 12 : 3;

  // DB 조회: active만, tab이 all이 아니면 category 필터
  let query = supabase.from("stores").select("*").eq("is_active", true);

  if (tab !== "all") {
    query = query.eq("category", tab);
  }

  // ✅ 랜덤 뽑기 위해 충분히 크게 가져옴 (너 DB가 850+니까 1000 정도면 안전)
  const { data, error } = await query.limit(1000);

  if (error || !data) {
    console.error("home-recommend error:", error);
    return NextResponse.json(
      { items: [], error: "failed_to_load" },
      { status: 500 }
    );
  }

  const stores = data as StoreRecord[];

  // ✅ 빈값/깨진 데이터 방어 (name 없는 row 같은 거)
  const clean = stores.filter((s) => s?.id && s?.name);

  // ✅ 랜덤 셔플 후 limit개만 선택
  const picked = shuffle(clean).slice(0, limit);

  // ✅ HomeCard 변환 (distance는 route에서 계산 안 함: 빌드 안정화 목적)
  const cards = picked.map(mapStoreToHomeCard);

  return NextResponse.json({ items: cards });
}
