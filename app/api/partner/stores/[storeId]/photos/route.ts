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
 * GET /api/partner/stores/[storeId]/photos - 목록
 * POST /api/partner/stores/[storeId]/photos - 추가 (body: { image_url })
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
    .from("store_photos")
    .select("id, image_url, sort_order, created_at")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[partner/photos] GET", error);
    return NextResponse.json({ error: "사진 목록을 불러올 수 없어요" }, { status: 500 });
  }
  return NextResponse.json({ photos: data ?? [] });
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

  let body: { image_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  const image_url = (body.image_url ?? "").trim();
  if (!image_url)
    return NextResponse.json({ error: "image_url 필요해요" }, { status: 400 });

  const { data: max } = await supabase
    .from("store_photos")
    .select("sort_order")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const sort_order = (max?.sort_order ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from("store_photos")
    .insert({ store_id: storeId, image_url, sort_order })
    .select("id, image_url, sort_order, created_at")
    .single();

  if (error) {
    console.error("[partner/photos] POST", error);
    return NextResponse.json({ error: "사진을 추가할 수 없어요" }, { status: 500 });
  }
  return NextResponse.json(inserted);
}
