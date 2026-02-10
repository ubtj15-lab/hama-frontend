// app/api/local/search/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "";
  if (!query) {
    return NextResponse.json({ documents: [] });
  }

  const res = await fetch(
    "https://dapi.kakao.com/v2/local/search/keyword.json?query=" +
      encodeURIComponent(query),
    {
      headers: {
        Authorization: `KakaoAK ${process.env.KAKAO_REST_KEY!}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text || "Kakao Local error", { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
