import { NextRequest, NextResponse } from "next/server";
import { HAMA_USER_ID_COOKIE } from "@/lib/server/authCookies";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get(HAMA_USER_ID_COOKIE)?.value?.trim();
  if (!userId) {
    return NextResponse.json({ user: null });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ user: null, error: "supabase_unavailable" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, nickname, kakao_id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.id) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: data.id,
      nickname: data.nickname ?? "카카오 사용자",
      points: 0,
    },
  });
}
