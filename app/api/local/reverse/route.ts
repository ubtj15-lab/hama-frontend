import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const x = searchParams.get("x") ?? ""; // 경도
  const y = searchParams.get("y") ?? ""; // 위도

  const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
  if (!KAKAO_KEY) {
    return NextResponse.json({ error: "KAKAO_REST_API_KEY missing" }, { status: 500 });
  }

  const url = new URL("https://dapi.kakao.com/v2/local/geo/coord2regioncode.json");
  url.searchParams.set("x", x);
  url.searchParams.set("y", y);

  const r = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    next: { revalidate: 0 },
  });

  const data = await r.json();
  return NextResponse.json(data);
}
