// app/api/home-recommend/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeTab(tab: string) {
  const t = (tab || "all").toLowerCase().trim();
  if (t === "beauty") return "salon";
  return t;
}

type CategoryKey = "restaurant" | "cafe" | "salon" | "activity";
type PlanItem = { category: CategoryKey; n: number };

// ✅ 종합 탭 기본 플랜: 12장 = 4/4/2/2
const BASE_PLAN: PlanItem[] = [
  { category: "restaurant", n: 4 },
  { category: "cafe", n: 4 },
  { category: "salon", n: 2 },
  { category: "activity", n: 2 },
];

function makeScaledPlan(totalCount: number): PlanItem[] {
  const baseTotal = BASE_PLAN.reduce((a, p) => a + p.n, 0);
  if (totalCount === baseTotal) return BASE_PLAN;

  const scale = totalCount / baseTotal;
  const scaled = BASE_PLAN.map((p) => ({
    category: p.category,
    n: Math.max(1, Math.round(p.n * scale)),
  }));

  return scaled;
}

function noStoreJson(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const tabRaw = url.searchParams.get("tab") || "all";
    const tab = normalizeTab(tabRaw);

    const count = toInt(url.searchParams.get("count"), tab === "all" ? 12 : 5);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log("[home-recommend] tab:", tab, "count:", count);
    console.log("[home-recommend] hasUrl:", !!supabaseUrl);
    console.log("[home-recommend] hasAnonKey:", !!supabaseAnonKey);

    if (!supabaseUrl || !supabaseAnonKey) {
      return noStoreJson({ items: [], error: "missing_env" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // ✅ 카테고리 탭: 해당 카테고리에서 count개 (새로고침마다 랜덤)
    if (tab !== "all") {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("category", tab)
        .not("name", "is", null)
        .neq("name", "")
        .order("id", { ascending: false }); // ✅ deterministic 제거 목적: 아래에서 랜덤 셔플

      if (error) {
        console.error("[home-recommend] supabase error:", error);
        return noStoreJson(
          { items: [], error: "supabase_select_failed", detail: error.message },
          500
        );
      }

      // ✅ 서버에서 랜덤 셔플 (DB random() 없이도 새로고침마다 바뀜)
      const arr = Array.isArray(data) ? [...data] : [];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }

      return noStoreJson({ items: arr.slice(0, count) }, 200);
    }

    // ✅ all 탭: 카테고리별로 가져와서 합치기 + 최종 셔플
    const plan = makeScaledPlan(count);

    // ✅ 각 카테고리에서 "조금 더 많이" 가져온 뒤 서버에서 셔플해서 n개만 뽑기
    // (DB random()을 못 쓰는 상황에서도 랜덤 체감 확보)
    const oversample = (n: number) => Math.min(Math.max(n * 6, 60), 400);

    const queries = plan.map((p) =>
      supabase
        .from("stores")
        .select("*")
        .eq("category", p.category)
        .not("name", "is", null)
        .neq("name", "")
        .limit(oversample(p.n))
    );

    const results = await Promise.all(queries);

    for (const r of results) {
      if (r.error) {
        console.error("[home-recommend] supabase error:", r.error);
        return noStoreJson(
          { items: [], error: "supabase_select_failed", detail: r.error.message },
          500
        );
      }
    }

    const pickedByCat = results.flatMap((r, idx) => {
      const arr = Array.isArray(r.data) ? [...r.data] : [];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr.slice(0, plan[idx]?.n ?? 0);
    });

    // ✅ 최종 합치고 한 번 더 셔플 (카테고리 순서 고정 느낌 제거)
    const merged = [...pickedByCat];
    for (let i = merged.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [merged[i], merged[j]] = [merged[j], merged[i]];
    }

    return noStoreJson({ items: merged.slice(0, count) }, 200);
  } catch (e: any) {
    console.error("[home-recommend] unexpected error:", e);
    return noStoreJson(
      { items: [], error: "failed_to_load", detail: e?.message ?? String(e) },
      500
    );
  }
}
