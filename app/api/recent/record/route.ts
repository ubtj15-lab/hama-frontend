import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env
  .NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

/** POST: 최근 본 기록 (모달 열 때 호출) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, store_id } = body as { user_id?: string; store_id?: string };

    if (!user_id || !store_id) {
      return NextResponse.json(
        { error: "user_id and store_id required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const { error } = await supabase.from("recent_views").upsert(
      {
        user_id,
        store_id,
        viewed_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,store_id",
        ignoreDuplicates: false,
      }
    );

    if (error) {
      console.error("recent record error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("recent record error:", err);
    return NextResponse.json(
      { ok: false, error: "record failed" },
      { status: 500 }
    );
  }
}
