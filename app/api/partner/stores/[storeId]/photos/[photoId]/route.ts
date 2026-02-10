import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function getUserIdFromRequest(req: NextRequest): string | null {
  return req.cookies.get("hama_user_id")?.value ?? null;
}

async function assertPartnerOwnsStore(
  supabase: ReturnType<typeof createClient>,
  storeId: string,
  userId: string
): Promise<NextResponse | null> {
  const { data } = await supabase
    .from("stores")
    .select("owner_id")
    .eq("id", storeId)
    .single();
  if (!data || data.owner_id !== userId)
    return NextResponse.json({ error: "이 매장을 수정할 권한이 없어요" }, { status: 403 });
  return null;
}

/** DELETE /api/partner/stores/[storeId]/photos/[photoId] */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string; photoId: string }> }
) {
  const userId = getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  const { storeId, photoId } = await params;
  const supabase = getSupabase();
  if (!supabase)
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const err = await assertPartnerOwnsStore(supabase, storeId, userId);
  if (err) return err;

  const { error } = await supabase
    .from("store_photos")
    .delete()
    .eq("id", photoId)
    .eq("store_id", storeId);

  if (error) {
    console.error("[partner/photos] DELETE", error);
    return NextResponse.json({ error: "사진을 삭제할 수 없어요" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
