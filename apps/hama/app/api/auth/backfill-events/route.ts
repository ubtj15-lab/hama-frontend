import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as
    | string
    | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

type Body = {
  session_id?: string;
  user_id?: string;
  kakao_id?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const sessionId = String(body.session_id ?? "").trim();
    let userId = String(body.user_id ?? "").trim();
    const kakaoId = String(body.kakao_id ?? "").trim();
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "session_id is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      console.error("backfill-events: supabase env missing");
      return NextResponse.json({ ok: true, updated: {} });
    }

    if (!userId && kakaoId) {
      const { data, error } = await supabase.from("users").select("id").eq("kakao_id", kakaoId).single();
      if (error) console.error("backfill-events users by kakao_id:", error.message);
      userId = data?.id ?? "";
    }
    if (!userId) {
      return NextResponse.json({ ok: false, error: "user_id or kakao_id is required" }, { status: 400 });
    }

    const result: Record<string, number> = {};

    const updateTable = async (table: "recommendation_events" | "events" | "log_events") => {
      const { data, error } = await supabase
        .from(table)
        .update({ user_id: userId })
        .eq("session_id", sessionId)
        .is("user_id", null)
        .select("id");
      if (error) {
        // log_events가 없는 환경을 포함해 UX는 막지 않는다.
        console.error(`backfill-events ${table}:`, error.message);
        return;
      }
      result[table] = Array.isArray(data) ? data.length : 0;
    };

    await updateTable("recommendation_events");
    await updateTable("events");
    await updateTable("log_events");

    return NextResponse.json({ ok: true, updated: result });
  } catch (e) {
    console.error("backfill-events failed:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
