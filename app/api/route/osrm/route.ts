import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/route/osrm?from=lng,lat&to=lng,lat&profile=driving|foot|bike
 * 예: /api/route/osrm?from=126.978,37.5665&to=127.0276,37.4979&profile=driving
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") || "").split(","); // [lng,lat]
  const to = (searchParams.get("to") || "").split(",");
  const profile = searchParams.get("profile") || "driving";

  if (from.length !== 2 || to.length !== 2) {
    return NextResponse.json({ error: "from/to must be 'lng,lat'" }, { status: 400 });
  }

  // OSRM 공개 서버 (지연/제한 있을 수 있음)
  const url = new URL(`https://router.project-osrm.org/route/v1/${profile}/${from.join(",")};${to.join(",")}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "true");

  const r = await fetch(url.toString(), { cache: "no-store" });
  const data = await r.json();
  return NextResponse.json(data);
}
