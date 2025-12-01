// app/api/log/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log("SUPABASE URL:", process.env.SUPABASE_URL);
  console.log("SUPABASE ANON KEY 존재?", !!process.env.SUPABASE_ANON_KEY);
  throw new Error("Supabase env not set. Check .env.local");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  const body = await req.json();
  const { type, data, ts } = body;

  console.log("HAMA LOG API BODY:", body);

  const { error } = await supabase.from("log_events").insert({
    type,
    data,
    ts,
  });

  if (error) {
    console.error("SUPABASE INSERT ERROR:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
