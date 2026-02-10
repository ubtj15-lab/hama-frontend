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

/**
 * PATCH /api/partner/stores/[storeId]/menus/[menuId] - 수정 (body: { name?, price?, description?, image_url? })
 * DELETE /api/partner/stores/[storeId]/menus/[menuId]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string; menuId: string }> }
) {
  const userId = getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  const { storeId, menuId } = await params;
  const supabase = getSupabase();
  if (!supabase)
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const err = await assertPartnerOwnsStore(supabase, storeId, userId);
  if (err) return err;

  let body: { name?: string; price?: string; description?: string; image_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  if (body.name !== undefined) updates.name = (body.name ?? "").trim() || null;
  if (body.price !== undefined) updates.price = (body.price ?? "").trim() || null;
  if (body.description !== undefined) updates.description = (body.description ?? "").trim() || null;
  if (body.image_url !== undefined) updates.image_url = (body.image_url ?? "").trim() || null;
  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "수정할 필드가 없어요" }, { status: 400 });

  const { data, error } = await supabase
    .from("store_menus")
    .update(updates)
    .eq("id", menuId)
    .eq("store_id", storeId)
    .select("id, name, price, description, image_url, sort_order, created_at")
    .single();

  if (error) {
    console.error("[partner/menus] PATCH", error);
    return NextResponse.json({ error: "메뉴를 수정할 수 없어요" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string; menuId: string }> }
) {
  const userId = getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  const { storeId, menuId } = await params;
  const supabase = getSupabase();
  if (!supabase)
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const err = await assertPartnerOwnsStore(supabase, storeId, userId);
  if (err) return err;

  const { error } = await supabase
    .from("store_menus")
    .delete()
    .eq("id", menuId)
    .eq("store_id", storeId);

  if (error) {
    console.error("[partner/menus] DELETE", error);
    return NextResponse.json({ error: "메뉴를 삭제할 수 없어요" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
