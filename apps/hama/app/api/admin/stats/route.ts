import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as
    | string
    | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

/** 오늘 0시 KST (UTC ISO 문자열) */
function getStartOfTodayKST(): string {
  const kstDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return new Date(`${kstDate}T00:00:00+09:00`).toISOString();
}

const EVENT_TYPES = [
  "home_card_open",
  "place_open_naver",
  "place_open_kakao",
  "place_detail_action",
  "search_recommend_card_click",
] as const;

/**
 * GET /api/admin/stats
 * 관리자용: 전체 이벤트·저장·최근본 집계 (오늘 / 전체)
 */
export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const startOfToday = getStartOfTodayKST();

  try {
    const totalCounts: Record<string, number> = {};
    const todayCounts: Record<string, number> = {};

    for (const type of EVENT_TYPES) {
      const { count: total, error: e1 } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("type", type);
      if (e1) console.error("[admin/stats] events", type, e1);
      totalCounts[type] = total ?? 0;

      const { count: today, error: e2 } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("type", type)
        .gte("created_at", startOfToday);
      if (e2) console.error("[admin/stats] events today", type, e2);
      todayCounts[type] = today ?? 0;
    }

    const [{ count: totalSaved }, { count: todaySaved }] = await Promise.all([
      supabase.from("saved").select("*", { count: "exact", head: true }),
      supabase.from("saved").select("*", { count: "exact", head: true }).gte("created_at", startOfToday),
    ]);

    const [{ count: totalRecent }, { count: todayRecent }] = await Promise.all([
      supabase.from("recent_views").select("*", { count: "exact", head: true }),
      supabase.from("recent_views").select("*", { count: "exact", head: true }).gte("viewed_at", startOfToday),
    ]);

    const totalClicks =
      (totalCounts["place_open_naver"] ?? 0) +
      (totalCounts["place_open_kakao"] ?? 0) +
      (totalCounts["place_detail_action"] ?? 0);
    const todayClicks =
      (todayCounts["place_open_naver"] ?? 0) +
      (todayCounts["place_open_kakao"] ?? 0) +
      (todayCounts["place_detail_action"] ?? 0);

    return NextResponse.json({
      today: {
        card_views: todayCounts["home_card_open"] ?? 0,
        saved_count: todaySaved ?? 0,
        recent_views_count: todayRecent ?? 0,
        naver_clicks: todayCounts["place_open_naver"] ?? 0,
        kakao_clicks: todayCounts["place_open_kakao"] ?? 0,
        detail_actions: todayCounts["place_detail_action"] ?? 0,
        search_clicks: todayCounts["search_recommend_card_click"] ?? 0,
        total_clicks: todayClicks,
      },
      total: {
        card_views: totalCounts["home_card_open"] ?? 0,
        saved_count: totalSaved ?? 0,
        recent_views_count: totalRecent ?? 0,
        naver_clicks: totalCounts["place_open_naver"] ?? 0,
        kakao_clicks: totalCounts["place_open_kakao"] ?? 0,
        detail_actions: totalCounts["place_detail_action"] ?? 0,
        search_clicks: totalCounts["search_recommend_card_click"] ?? 0,
        total_clicks: totalClicks,
      },
    });
  } catch (err) {
    console.error("[admin/stats]", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
