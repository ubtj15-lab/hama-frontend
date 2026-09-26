import { NextRequest, NextResponse } from "next/server";
import {
  boundedRecord,
  clipText,
  isAllowedHamaEventName,
} from "@/lib/server/activityEventGuard";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getVerifiedUserId } from "@/lib/server/verifiedSession";

export const dynamic = "force-dynamic";

function textList(value: unknown, maxItems: number, maxLen: number): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const items: string[] = [];
  for (const item of value) {
    const text = clipText(item, maxLen);
    if (!text) return null;
    items.push(text);
  }
  return items;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const eventName = clipText(body.event_name, 64);
  if (!eventName || !isAllowedHamaEventName(eventName)) {
    return NextResponse.json({ ok: false, error: "invalid_event_type" }, { status: 400 });
  }
  const metadata = boundedRecord(body.metadata);
  const situationTags = textList(body.situation_tags, 20, 40);
  if (!metadata || (body.situation_tags != null && !situationTags)) {
    return NextResponse.json({ ok: false, error: "invalid_event_data" }, { status: 400 });
  }

  const userId = await getVerifiedUserId(req);
  const rank = typeof body.rank_position === "number" && Number.isFinite(body.rank_position) ? body.rank_position : null;
  const row = {
    event_name: eventName,
    session_id: clipText(body.session_id, 128),
    user_id: userId,
    query: clipText(body.query, 200),
    intent: clipText(body.intent, 80),
    category: clipText(body.category, 80),
    mode: clipText(body.mode, 80),
    source: clipText(body.source, 80),
    place_id: clipText(body.place_id, 80),
    place_name: clipText(body.place_name, 120),
    place_category: clipText(body.place_category, 80),
    rank_position: rank,
    action: clipText(body.action, 80),
    situation_tags: situationTags,
    metadata,
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

  const { error } = await supabase.from("hama_events").insert(row);
  if (error) {
    console.error("[api/events] insert failed", error.code);
    return NextResponse.json({ ok: false, error: "event_write_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
