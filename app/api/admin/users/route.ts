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
 * GET /api/admin/users?q=검색어
 * 관리자용: 유저 목록 (id, nickname), 닉네임 검색
 */
export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ users: [] }, { status: 500 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 50, 100);

  try {
    let query = supabase
      .from("users")
      .select("id, nickname")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (q.length >= 1) {
      query = query.ilike("nickname", `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[admin/users]", error);
      return NextResponse.json({ users: [] }, { status: 500 });
    }

    return NextResponse.json({ users: data ?? [] });
  } catch (err) {
    console.error("[admin/users]", err);
    return NextResponse.json({ users: [] }, { status: 500 });
  }
}
