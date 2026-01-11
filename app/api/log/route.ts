import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("HAMA LOG:", body);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("HAMA LOG ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "log failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: true, message: "log endpoint running" },
    { status: 200 }
  );
}
