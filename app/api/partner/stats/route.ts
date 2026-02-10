import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env
  .NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

function getUserIdFromRequest(req: NextRequest): string | null {
  const cookie = req.cookies.get("hama_user_id");
  return cookie?.value ?? null;
}

/** 오늘 0시 KST (UTC ISO 문자열) */
function getStartOfTodayKST(): string {
  const kstDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return new Date(`${kstDate}T00:00:00+09:00`).toISOString();
}

type Period = "today" | "7d" | "30d";

/** 기간 시작 시점 KST 0시 (UTC ISO) */
function getPeriodStartKST(period: Period): string {
  const startOfToday = getStartOfTodayKST();
  if (period === "today") return startOfToday;
  const ms = new Date(startOfToday).getTime();
  const days = period === "7d" ? 7 : 30;
  return new Date(ms - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * GET /api/partner/stats?store_id=xxx&period=today|7d|30d
 * 매장주 대시보드용 - 로그인 필수, 본인 매장만 조회 가능
 * period: 오늘(today), 최근 7일(7d), 최근 30일(30d). 기본값 today.
 */
export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  const store_id = req.nextUrl.searchParams.get("store_id");
  const periodParam = req.nextUrl.searchParams.get("period") ?? "today";
  const period: Period =
    periodParam === "7d" || periodParam === "30d" ? periodParam : "today";

  if (!store_id) {
    return NextResponse.json(
      { error: "store_id required" },
      { status: 400 }
    );
  }

  const periodStart = getPeriodStartKST(period);
  const startOfToday = getStartOfTodayKST();

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  try {
    const { data: storeRow } = await supabase
      .from("stores")
      .select("id, owner_id")
      .eq("id", store_id)
      .single();

    if (storeRow && (storeRow.owner_id === null || storeRow.owner_id !== userId)) {
      return NextResponse.json(
        { error: "이 매장의 통계를 볼 권한이 없어요" },
        { status: 403 }
      );
    }

    // 1) events에서 store_id별 집계 (data->>'id' = store_id)
    const eventTypes = [
      "home_card_open",       // 카드 상세 열람
      "place_open_naver",    // 네이버 링크 클릭
      "place_open_kakao",    // 카카오 링크 클릭
      "place_detail_action", // 길안내/예약 버튼 클릭
      "search_recommend_card_click", // 검색 추천 카드 클릭
    ];

    const counts: Record<string, number> = {};
    for (const type of eventTypes) {
      const { count, error } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("type", type)
        .contains("data", { id: store_id })
        .gte("created_at", periodStart);

      if (error) {
        console.error(`[partner/stats] events ${type}:`, error);
        counts[type] = 0;
      } else {
        counts[type] = count ?? 0;
      }
    }
    const todayCounts: Record<string, number> = {};
    for (const type of eventTypes) {
      const { count, error } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("type", type)
        .contains("data", { id: store_id })
        .gte("created_at", startOfToday);

      if (error) todayCounts[type] = 0;
      else todayCounts[type] = count ?? 0;
    }

    // 2) saved 테이블: 해당 store 저장 수 (기간 내)
    const { count: savedCount, error: savedError } = await supabase
      .from("saved")
      .select("*", { count: "exact", head: true })
      .eq("store_id", store_id)
      .gte("created_at", periodStart);

    if (savedError) console.error("[partner/stats] saved:", savedError);

    const { count: todaySavedCount, error: todaySavedError } = await supabase
      .from("saved")
      .select("*", { count: "exact", head: true })
      .eq("store_id", store_id)
      .gte("created_at", startOfToday);

    if (todaySavedError) console.error("[partner/stats] saved today:", todaySavedError);

    // 3) recent_views 테이블: 조회 수 (기간 내)
    const { count: recentCount, error: recentError } = await supabase
      .from("recent_views")
      .select("*", { count: "exact", head: true })
      .eq("store_id", store_id)
      .gte("viewed_at", periodStart);

    if (recentError) console.error("[partner/stats] recent_views:", recentError);

    const { count: todayRecentCount, error: todayRecentError } = await supabase
      .from("recent_views")
      .select("*", { count: "exact", head: true })
      .eq("store_id", store_id)
      .gte("viewed_at", startOfToday);

    if (todayRecentError) console.error("[partner/stats] recent_views today:", todayRecentError);

    const { data: storeInfo } = await supabase
      .from("stores")
      .select("id, name, category, cover_image_url")
      .eq("id", store_id)
      .single();

    const totalClicks =
      (counts["place_open_naver"] ?? 0) +
      (counts["place_open_kakao"] ?? 0) +
      (counts["place_detail_action"] ?? 0);
    const todayTotalClicks =
      (todayCounts["place_open_naver"] ?? 0) +
      (todayCounts["place_open_kakao"] ?? 0) +
      (todayCounts["place_detail_action"] ?? 0);

    return NextResponse.json({
      store_id,
      store_name: storeInfo?.name ?? null,
      store_category: storeInfo?.category ?? null,
      cover_image_url: storeInfo?.cover_image_url ?? null,
      period,
      period_label: period === "today" ? "오늘" : period === "7d" ? "최근 7일" : "최근 30일",

      // 기간 내 집계
      card_views: counts["home_card_open"] ?? 0,
      naver_clicks: counts["place_open_naver"] ?? 0,
      kakao_clicks: counts["place_open_kakao"] ?? 0,
      detail_actions: counts["place_detail_action"] ?? 0,
      search_clicks: counts["search_recommend_card_click"] ?? 0,

      saved_count: savedCount ?? 0,
      recent_views_count: recentCount ?? 0,
      total_clicks: totalClicks,

      // 오늘 요약 (0시 KST 기준)
      today_card_views: todayCounts["home_card_open"] ?? 0,
      today_saved_count: todaySavedCount ?? 0,
      today_recent_views_count: todayRecentCount ?? 0,
      today_total_clicks: todayTotalClicks,
    });
  } catch (err) {
    console.error("[partner/stats]", err);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
