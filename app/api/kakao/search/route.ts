// 서버전용: Kakao REST API 키를 헤더로 붙여 프록시
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("query") ?? "";

  if (!q) {
    return NextResponse.json({ documents: [] }, { status: 200 });
  }

  const REST_KEY = process.env.KAKAO_REST_API_KEY;
  if (!REST_KEY) {
    return NextResponse.json(
      { error: "KAKAO_REST_API_KEY is missing" },
      { status: 500 }
    );
  }

  const url =
    "https://dapi.kakao.com/v2/local/search/keyword.json?query=" +
    encodeURIComponent(q);

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${REST_KEY}` },
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data);
}
