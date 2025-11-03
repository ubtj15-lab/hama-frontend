// Next.js (App Router) API Route - 프록시
import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = process.env.BACKEND_BASE ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "";
  try {
    const r = await fetch(`${BACKEND_BASE}/api/places/search?query=${encodeURIComponent(query)}`, {
      // 백엔드에 CORS 미설정이면, credentials 등은 빼두는 게 안전
      method: "GET",
      headers: { "accept": "application/json" },
      cache: "no-store",
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "proxy-error" }, { status: 500 });
  }
}
