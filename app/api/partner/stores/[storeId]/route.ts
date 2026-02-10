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
 * PATCH /api/partner/stores/[storeId]
 * 매장 대표 이미지 등록/수정 (body: { cover_image_url })
 */
export async function PATCH(
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

  let body: { cover_image_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const cover_image_url =
    body.cover_image_url !== undefined
      ? (String(body.cover_image_url).trim() || null)
      : undefined;
  if (cover_image_url === undefined)
    return NextResponse.json({ error: "cover_image_url 필요해요" }, { status: 400 });

  const { data, error } = await supabase
    .from("stores")
    .update({ cover_image_url })
    .eq("id", storeId)
    .select("id, name, cover_image_url")
    .single();

  if (error) {
    console.error("[partner/stores PATCH]", error);
    return NextResponse.json({ error: "대표 이미지를 저장할 수 없어요" }, { status: 500 });
  }
  return NextResponse.json(data);
}
