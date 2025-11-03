import { NextResponse } from "next/server";
import { PLACES } from "@/data/places";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();

    // 쿼리 없으면 빈 결과
    if (!q) return NextResponse.json({ ok: true, results: [] });

    // 이름/카테고리/주소 간단 필터
    const results = PLACES.filter((p) => {
      const hay = `${p.name} ${p.category} ${p.address ?? ""}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 20);

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[GET /api/search] error:", err);
    return NextResponse.json(
      { ok: false, code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
