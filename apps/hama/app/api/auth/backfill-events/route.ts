import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUserId } from "@/lib/server/verifiedSession";

export const dynamic = "force-dynamic";

/**
 * 클라이언트가 보낸 session_id 는 익명 행의 소유 증명이 아니다.
 * 다른 사용자의 기록이나 소유자가 없는 기록을 여기서 수정하지 않는다.
 */
export async function POST(req: NextRequest) {
  const userId = await getVerifiedUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: false, error: "owner_required" }, { status: 403 });
}
