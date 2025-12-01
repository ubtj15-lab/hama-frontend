// app/api/log/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 🔹 Supabase 클라이언트를 "요청 시점"에만 만든다
function getSupabaseClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 디버그용 로그 (빌드 시점에는 안 찍힘. POST가 실제로 호출될 때만 찍힘)
  console.log("SUPABASE URL:", supabaseUrl);
  console.log("SUPABASE ANON KEY 존재?", !!supabaseAnonKey);

  if (!supabaseUrl || !supabaseAnonKey) {
    // 런타임에서 env가 없으면 여기서만 에러를 던진다 (빌드엔 영향 X)
    throw new Error("Supabase env not set. Check Vercel env & .env.local");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function POST(req: Request) {
  // ❗ 여기서만 Supabase 사용
  const supabase = getSupabaseClient();

  const body = await req.json();
  const { type, data, ts } = body;

  await supabase.from("log_events").insert({
    type,
    data,
    ts,
  });

  return NextResponse.json({ ok: true });
}
