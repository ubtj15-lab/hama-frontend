import { NextRequest, NextResponse } from "next/server";
import {
  MAX_ACTIVITY_EVENTS,
  boundedRecord,
  clipText,
  isAllowedProductLogType,
} from "@/lib/server/activityEventGuard";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getVerifiedUserId } from "@/lib/server/verifiedSession";

export const dynamic = "force-dynamic";

type Incoming = {
  session_id?: unknown;
  type?: unknown;
  data?: unknown;
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const events = (Array.isArray(body) ? body : [body]) as Incoming[];
  if (events.length === 0 || events.length > MAX_ACTIVITY_EVENTS) {
    return NextResponse.json({ ok: false, error: "invalid_events" }, { status: 400 });
  }

  const userId = await getVerifiedUserId(req);
  const rows = [];
  for (const event of events) {
    if (!event || typeof event !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_events" }, { status: 400 });
    }
    const type = clipText(event.type, 64);
    if (!type || !isAllowedProductLogType(type)) {
      return NextResponse.json({ ok: false, error: "invalid_event_type" }, { status: 400 });
    }
    const data = boundedRecord(event.data);
    if (!data) {
      return NextResponse.json({ ok: false, error: "invalid_event_data" }, { status: 400 });
    }
    rows.push({
      user_id: userId,
      session_id: clipText(event.session_id, 128) ?? "unknown",
      type,
      data,
    });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

  const { error } = await supabase.from("events").insert(rows);
  if (error) {
    console.error("HAMA LOG Supabase", error.code);
    return NextResponse.json({ ok: false, error: "event_write_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "log endpoint running" }, { status: 200 });
}
