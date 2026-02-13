// app/api/mock-reservations/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  // 여기서는 단순히 에코 + 서버시간 반환 (DB 저장은 다음 단계에서)
  return NextResponse.json(
    {
      ok: true,
      received: body,
      serverTime: new Date().toISOString(),
      note: "This is a mock endpoint. Next step: connect to real DB and insert.",
    },
    { status: 200 }
  );
}
