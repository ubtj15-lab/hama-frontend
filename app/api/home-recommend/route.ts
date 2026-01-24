// app/api/home-recommend/route.ts
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
      return NextResponse.json({ items: [], error: "missing_env" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // ✅ 카테고리 탭: 해당 카테고리에서 count개
    if (tab !== "all") {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("category", tab)
        // ✅ 핵심: name 없는 레코드 제거 (프론트에서 전부 필터링되어 "0개" 되는 문제 방지)
        .not("name", "is", null)
        .neq("name", "")
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

    // ✅ all 탭: 카테고리별로 가져와서 합치기
    const plan = makeScaledPlan(count);

    const queries = plan.map((p) =>
      supabase
        .from("stores")
        .select("*")
        .eq("category", p.category)
        // ✅ 여기도 동일하게 name 필터
        .not("name", "is", null)
        .neq("name", "")
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

    const merged = results.flatMap((r) => r.data ?? []);
    return NextResponse.json({ items: merged.slice(0, count) }, { status: 200 });
  } catch (e: any) {
    console.error("[home-recommend] unexpected error:", e);
    return NextResponse.json(
      { items: [], error: "failed_to_load", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
