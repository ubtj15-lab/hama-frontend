import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const n = Math.max(1, Math.min(Number(url.searchParams.get("n") ?? "10"), 100)); // 1~100
    const now = Date.now();

    const payload = Array.from({ length: n }).map((_, i) => ({
      name: `더미 ${String(i + 1).padStart(2, "0")}`,
      ts: new Date(now - i * 1000 * 60),
      status: "PENDING" as const,
    }));

    const created = await prisma.$transaction(
      payload.map((data) => prisma.reservation.create({ data }))
    );

    return NextResponse.json({ ok: true, count: created.length });
  } catch (err: any) {
    return NextResponse.json({ ok: false, code: "SERVER_ERROR", message: err?.message ?? String(err) }, { status: 500 });
  }
}
