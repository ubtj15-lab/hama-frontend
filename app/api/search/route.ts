// app/api/search/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json({ documents: [] }, { status: 200 });
  }

  const KEY =
    process.env.KAKAO_REST_API_KEY ??
    process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY ??
    "";

  const url =
    "https://dapi.kakao.com/v2/local/search/keyword.json?query=" +
    encodeURIComponent(q);

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KEY}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "Kakao REST error", status: res.status, body: text },
      { status: 500 }
    );
  }

  const json = await res.json();
  return NextResponse.json(json);
}
