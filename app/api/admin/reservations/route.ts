import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const reservations = await prisma.reservation.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, data: reservations });
  } catch (e: any) {
    console.error("[ADMIN_RESERVATIONS][ERROR]", e);
    return NextResponse.json(
      { ok: false, error: e.message ?? "unknown_error" },
      { status: 500 }
    );
  }
}
