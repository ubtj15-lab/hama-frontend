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
  supabase: any,
  storeId: string,
  userId: string
): Promise<NextResponse | null> {
  const { data } = await supabase
    .from("stores")
    .select("owner_id")
    .eq("id", storeId)
    .single();
  const ownerId = (data as { owner_id?: string | null } | null)?.owner_id ?? null;
  if (!ownerId || ownerId !== userId)
    return NextResponse.json({ error: "이 매장을 수정할 권한이 없어요" }, { status: 403 });
  return null;
}

/**
 * GET /api/partner/stores/[storeId]/menus - 목록
 * POST /api/partner/stores/[storeId]/menus - 추가 (body: { name, price?, description?, image_url? })
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const userId = getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  const { storeId } = await params;
  const supabase = getSupabase();
  if (!supabase)
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const err = await assertPartnerOwnsStore(supabase, storeId, userId);
  if (err) return err;

  const { data, error } = await supabase
    .from("store_menus")
    .select("id, name, price, description, image_url, sort_order, created_at")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[partner/menus] GET", error);
    return NextResponse.json({ error: "메뉴 목록을 불러올 수 없어요" }, { status: 500 });
  }
  return NextResponse.json({ menus: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const userId = getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  const { storeId } = await params;
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
  const name = (body.name ?? "").trim();
  if (!name)
    return NextResponse.json({ error: "메뉴 이름이 필요해요" }, { status: 400 });

  const { data: max } = await supabase
    .from("store_menus")
    .select("sort_order")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const sort_order = (max?.sort_order ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from("store_menus")
    .insert({
      store_id: storeId,
      name,
      price: (body.price ?? "").trim() || null,
      description: (body.description ?? "").trim() || null,
      image_url: (body.image_url ?? "").trim() || null,
      sort_order,
    })
    .select("id, name, price, description, image_url, sort_order, created_at")
    .single();

  if (error) {
    console.error("[partner/menus] POST", error);
    return NextResponse.json({ error: "메뉴를 추가할 수 없어요" }, { status: 500 });
  }
  return NextResponse.json(inserted);
}
