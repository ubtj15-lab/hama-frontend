import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env
  .NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

function getUserIdFromRequest(req: NextRequest): string | null {
  const cookie = req.cookies.get("hama_user_id");
  return cookie?.value ?? null;
}

/**
 * GET /api/partner/stores?q=검색어
 * 매장주 대시보드용 - 로그인 필수, 본인 매장만 (owner_id 일치)
 */
export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 20, 50);

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ stores: [] });
  }

  try {
    let query = supabase
      .from("stores")
      .select("id, name, category, area")
      .eq("owner_id", userId)
      .order("name", { ascending: true })
      .limit(limit);

    if (q.length >= 1) {
      query = query.ilike("name", `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[partner/stores]", error);
      return NextResponse.json({ stores: [] });
    }

    return NextResponse.json({ stores: data ?? [] });
  } catch (err) {
    console.error("[partner/stores]", err);
    return NextResponse.json({ stores: [] });
  }
}
