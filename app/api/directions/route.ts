// app/api/directions/route.ts
import { NextResponse } from "next/server";

/**
 * GET /api/directions?origin=lng,lat&destination=lng,lat
 *  - origin / destination 은 "lng,lat" (경도,위도) 순서!
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const origin = url.searchParams.get("origin") || "";
    const destination = url.searchParams.get("destination") || "";

    if (!origin || !destination) {
      return NextResponse.json(
        { error: "origin,destination query required" },
        { status: 400 }
      );
    }

    const KEY =
      process.env.KAKAO_REST_API_KEY ||
      process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY ||
      "";

    if (!KEY) {
      return NextResponse.json(
        { error: "KAKAO_REST_API_KEY missing" },
        { status: 500 }
      );
    }

    // Kakao Mobility Directions (자동차 길찾기)
    const kakaoUrl =
      "https://apis-navi.kakaomobility.com/v1/directions" +
      `?origin=${encodeURIComponent(origin)}` +
      `&destination=${encodeURIComponent(destination)}` +
      `&priority=TIME`; // 시간우선 기본값

    const res = await fetch(kakaoUrl, {
      headers: {
        Authorization: `KakaoAK ${KEY}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Kakao Mobility error", status: res.status, body: text },
        { status: 500 }
      );
    }

    const json: any = await res.json();

    // 가장 흔한 응답 형태: routes[0].sections[].roads[].vertexes => [x1,y1,x2,y2,...]
    const route = json?.routes?.[0];
    if (!route) {
      return NextResponse.json({ path: [], summary: null }, { status: 200 });
    }

    const summary = route.summary ?? null;

    const path: [number, number][] = []; // [lat, lng] 형태로 반환
    for (const sec of route.sections ?? []) {
      for (const road of sec.roads ?? []) {
        const v = road.vertexes as number[]; // ...[x,y,x,y,...]
        for (let i = 0; i < v.length - 1; i += 2) {
          const x = v[i]; // lng
          const y = v[i + 1]; // lat
          path.push([y, x]);
        }
      }
    }

    return NextResponse.json({ path, summary }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}
