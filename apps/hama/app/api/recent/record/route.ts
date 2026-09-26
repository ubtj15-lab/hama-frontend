import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getVerifiedUserId } from "@/lib/server/verifiedSession";

export const dynamic = "force-dynamic";

/** POST: 검증된 세션 사용자의 최근 본 기록. 본문의 user_id는 무시한다. */
export async function POST(req: NextRequest) {
  const userId = await getVerifiedUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let storeId = "";
  try {
    const body = (await req.json()) as { store_id?: string };
    storeId = String(body.store_id ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!storeId) {
    return NextResponse.json({ ok: false, error: "store_id required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

  const { error } = await supabase.from("recent_views").upsert(
    {
      user_id: userId,
      store_id: storeId,
      viewed_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,store_id",
      ignoreDuplicates: false,
    }
  );

  if (error) {
    console.error("recent record error", error.code, error.message);
    return NextResponse.json({ ok: false, error: "recent_write_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
