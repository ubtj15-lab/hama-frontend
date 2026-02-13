import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim();
  if (!query) return NextResponse.json({ items: [] });

  const REST_KEY = process.env.KAKAO_REST_KEY!;
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(
    query
  )}&size=12`;

  const resp = await fetch(url, {
    headers: { Authorization: `KakaoAK ${REST_KEY}` },
    // Kakao는 CORS 허용, Next API 서버에서 호출하면 안전
    cache: "no-store",
  });

  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json({ error: text }, { status: resp.status });
  }

  const data = await resp.json();

  // 프론트에서 쓰기 쉬운 형태로 매핑
  const items = (data?.documents ?? []).map((d: any) => ({
    id: d.id,
    name: d.place_name,
    address: d.road_address_name || d.address_name,
    x: parseFloat(d.x), // 경도
    y: parseFloat(d.y), // 위도
    // 카드 썸네일 자리는 임시 (원하면 카테고리별 아이콘 매핑)
    thumb:
      "https://dummyimage.com/200x140/e9eef5/8aa0b3&text=" +
      encodeURIComponent(d.place_name.slice(0, 12)),
  }));

  return NextResponse.json({ items });
}
