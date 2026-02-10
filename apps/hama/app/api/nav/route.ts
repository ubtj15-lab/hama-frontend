// app/api/nav/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const origin = searchParams.get("origin");         // "lng,lat"
  const destination = searchParams.get("destination"); // "lng,lat"

  if (!origin || !destination) {
    return NextResponse.json({ error: "missing query" }, { status: 400 });
  }

  const REST_KEY = process.env.KAKAO_REST_KEY;
  if (!REST_KEY) {
    return NextResponse.json({ error: "no rest key" }, { status: 500 });
  }

  const url =
    `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin}&destination=${destination}`;

  const r = await fetch(url, {
    headers: { Authorization: `KakaoAK ${REST_KEY}` },
    // 캐시 방지
    next: { revalidate: 0 },
  });

  if (!r.ok) {
    const txt = await r.text();
    return NextResponse.json({ error: "upstream", detail: txt }, { status: 502 });
  }
  const data = await r.json();
  return NextResponse.json(data);
}
