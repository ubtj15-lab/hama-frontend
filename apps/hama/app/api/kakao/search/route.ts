// app/api/kakao/search/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY ?? "";

if (!KAKAO_REST_API_KEY) {
  console.warn("[KAKAO] KAKAO_REST_API_KEY 환경변수가 설정되어 있지 않습니다.");
}

const KAKAO_BASE_URL = "https://dapi.kakao.com/v2/local";

async function callKakao(path: string, params: URLSearchParams) {
  const url = `${KAKAO_BASE_URL}${path}?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[KAKAO] error", res.status, text);
    throw new Error(`Kakao API error: ${res.status}`);
  }

  return res.json();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const query = searchParams.get("query");
    const category = searchParams.get("category");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    const page = searchParams.get("page") ?? "1";
    const size = searchParams.get("size") ?? "9"; // 한 번에 최대 9개까지

    // query, category 둘 다 없으면 바로 빈 결과
    if (!category && !query) {
      return NextResponse.json(
        { documents: [], message: "no query or category" },
        { status: 200 }
      );
    }

    // ✅ 1) category + lat/lng 이 있으면 "내 주변 카테고리 검색" 강제
    //    = 근처 카페 / 근처 식당 / 근처 미용실 전부 이쪽으로 옴
    if (category && lat && lng) {
      const params = new URLSearchParams();
      params.set("category_group_code", category);
      params.set("x", lng); // 경도
      params.set("y", lat); // 위도
      params.set("radius", "2000"); // 2km 반경
      params.set("sort", "distance"); // 거리순
      params.set("page", page);
      params.set("size", size);

      const json = await callKakao("/search/category.json", params);
      return NextResponse.json(json, { status: 200 });
    }

    // ✅ 2) 그 외에는 키워드 검색 (좌표 있으면 radius 적용)
    const params = new URLSearchParams();
    params.set("query", query ?? "");

    if (category) params.set("category_group_code", category);
    if (lat && lng) {
      params.set("x", lng);
      params.set("y", lat);
      params.set("radius", "2000");
    }

    params.set("page", page);
    params.set("size", size);

    const json = await callKakao("/search/keyword.json", params);
    return NextResponse.json(json, { status: 200 });
  } catch (err) {
    console.error("[KAKAO] search handler error", err);
    return NextResponse.json(
      { documents: [], error: "kakao search failed" },
      { status: 500 }
    );
  }
}
