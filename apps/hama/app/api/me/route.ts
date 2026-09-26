import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getVerifiedUserId } from "@/lib/server/verifiedSession";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getVerifiedUserId(req);
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
