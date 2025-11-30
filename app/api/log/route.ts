// app/api/log/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log("SUPABASE URL:", supabaseUrl);
console.log("SUPABASE ANON KEY 존재?", !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  // 여기 오면 .env.local 을 못 읽은 상태
  throw new Error("Supabase env not set. Check .env.local");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  const body = await req.json();
  const { type, data, ts } = body;

  await supabase.from("log_events").insert({
    type,
    data,
    ts,
  });

  return NextResponse.json({ ok: true });
}
