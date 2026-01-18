import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeTab(tab: string) {
  const t = (tab || "all").toLowerCase().trim();
  // 과거 호환
  if (t === "beauty") return "salon";
  return t;
}

type PlanItem = { category: "restaurant" | "cafe" | "salon" | "activity"; n: number };

// ✅ 종합 탭 기본 플랜: 12장 = 4/4/2/2 (식당→카페→미용실→액티비티)
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

  // 합이 totalCount보다 커질 수 있어도 최종 slice로 맞출 예정
  return scaled;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const tabRaw = url.searchParams.get("tab") || "all";
    const tab = normalizeTab(tabRaw);

    // 클라에서 count를 보내면 우선 사용
    // - all: 기본 12
    // - 카테고리: 기본 5
    const count = toInt(url.searchParams.get("count"), tab === "all" ? 12 : 5);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log("[home-recommend] tab:", tab, "count:", count);
    console.log("[home-recommend] hasUrl:", !!supabaseUrl);
    console.log("[home-recommend] hasAnonKey:", !!supabaseAnonKey);

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ items: [], error: "missing_env" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // ✅ 카테고리 탭: 해당 카테고리에서 무조건 5개(또는 count)
    if (tab !== "all") {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("category", tab)
        // 랜덤 대체(단순 반복 방지용): id 정렬
        .order("id", { ascending: false })
        .limit(count);

      if (error) {
        console.error("[home-recommend] supabase error:", error);
        return NextResponse.json(
          { items: [], error: "supabase_select_failed", detail: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ items: data ?? [] }, { status: 200 });
    }

    // ✅ all 탭: 카테고리별로 가져오고 "식당→카페→미용실→액티비티" 순서로 합치기
    const plan = makeScaledPlan(count);

    // ⚠️ 중요: 이 순서가 곧 merged 순서가 됨 (식당→카페→미용실→액티비티)
    const queries = plan.map((p) =>
      supabase
        .from("stores")
        .select("*")
        .eq("category", p.category)
        .order("id", { ascending: false })
        .limit(p.n)
    );

    const results = await Promise.all(queries);

    for (const r of results) {
      if (r.error) {
        console.error("[home-recommend] supabase error:", r.error);
        return NextResponse.json(
          { items: [], error: "supabase_select_failed", detail: r.error.message },
          { status: 500 }
        );
      }
    }

    // ✅ 계획 순서대로 합침 = 식당→카페→미용실→액티비티
    const merged = results.flatMap((r) => r.data ?? []);

    // 최종 안전장치: count만큼만 반환
    return NextResponse.json({ items: merged.slice(0, count) }, { status: 200 });
  } catch (e: any) {
    console.error("[home-recommend] unexpected error:", e);
    return NextResponse.json(
      { items: [], error: "failed_to_load", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
