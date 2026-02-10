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

/**
 * GET /api/partner/stats?store_id=xxx
 * 매장주 대시보드용 - 로그인 필수, 본인 매장만 조회 가능
 */
export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  const store_id = req.nextUrl.searchParams.get("store_id");

  if (!store_id) {
    return NextResponse.json(
      { error: "store_id required" },
      { status: 400 }
    );
  }

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
        .contains("data", { id: store_id });

      if (error) {
        console.error(`[partner/stats] events ${type}:`, error);
        counts[type] = 0;
      } else {
        counts[type] = count ?? 0;
      }
    }

    // 2) saved 테이블: 해당 store 저장 수
    const { count: savedCount, error: savedError } = await supabase
      .from("saved")
      .select("*", { count: "exact", head: true })
      .eq("store_id", store_id);

    if (savedError) console.error("[partner/stats] saved:", savedError);

    // 3) recent_views 테이블: 조회 수 (unique user_id 기준 또는 행 수)
    const { count: recentCount, error: recentError } = await supabase
      .from("recent_views")
      .select("*", { count: "exact", head: true })
      .eq("store_id", store_id);

    if (recentError) console.error("[partner/stats] recent_views:", recentError);

    const { data: storeInfo } = await supabase
      .from("stores")
      .select("id, name, category")
      .eq("id", store_id)
      .single();

    return NextResponse.json({
      store_id,
      store_name: storeInfo?.name ?? null,
      store_category: storeInfo?.category ?? null,

      // 이벤트별 집계
      card_views: counts["home_card_open"] ?? 0,
      naver_clicks: counts["place_open_naver"] ?? 0,
      kakao_clicks: counts["place_open_kakao"] ?? 0,
      detail_actions: counts["place_detail_action"] ?? 0,
      search_clicks: counts["search_recommend_card_click"] ?? 0,

      // 저장·조회
      saved_count: savedCount ?? 0,
      recent_views_count: recentCount ?? 0,

      // 요약 (매장주가 보기 쉬운 형태)
      total_clicks:
        (counts["place_open_naver"] ?? 0) +
        (counts["place_open_kakao"] ?? 0) +
        (counts["place_detail_action"] ?? 0),
    });
  } catch (err) {
    console.error("[partner/stats]", err);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
