import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as
    | string
    | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/admin/stores?q=검색어
 * 관리자용: 매장 전체 검색 (owner_id 무관)
 */
export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ stores: [] }, { status: 500 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 30, 100);

  try {
    let query = supabase
      .from("stores")
      .select("id, name, category, area, owner_id")
      .order("name", { ascending: true })
      .limit(limit);

    if (q.length >= 1) {
      query = query.ilike("name", `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[admin/stores]", error);
      return NextResponse.json({ stores: [] }, { status: 500 });
    }

    return NextResponse.json({ stores: data ?? [] });
  } catch (err) {
    console.error("[admin/stores]", err);
    return NextResponse.json({ stores: [] }, { status: 500 });
  }
}
