import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env
  .NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const events = Array.isArray(body) ? body : [body];

    const supabase = getSupabase();
    if (supabase) {
      const rows = events.map((e: { user_id?: string; session_id?: string; type?: string; data?: object }) => ({
        user_id: e.user_id ?? null,
        session_id: e.session_id ?? "unknown",
        type: e.type ?? "unknown",
        data: e.data ?? {},
      }));
      const { error } = await supabase.from("events").insert(rows);
      if (error) console.error("HAMA LOG Supabase:", error);
    } else {
      console.log("HAMA LOG (no Supabase):", body);
    }

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
