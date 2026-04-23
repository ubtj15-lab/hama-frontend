import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * GET ?scenario=date — `recommendation_pattern_stats` 를 pattern_key → learned_boost 맵으로 반환
 * 코스 랭킹에서 `recommendationPatternBoostMap` 구축용
 */
export async function GET(req: NextRequest) {
  const scenario = req.nextUrl.searchParams.get("scenario");
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ boosts: {} as Record<string, number> });
  }
  let q = supabase.from("recommendation_pattern_stats").select("pattern_key, learned_boost, impressions");
  if (scenario) {
    q = q.eq("scenario", scenario);
  }
  const { data, error } = await q.limit(5000);
  if (error) {
    console.error("pattern-stats", error);
    return NextResponse.json({ boosts: {} }, { status: 200 });
  }
  const boosts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.pattern_key) {
      const imp = (row as { impressions?: number }).impressions ?? 0;
      if (imp >= 20) {
        boosts[row.pattern_key] = Number((row as { learned_boost: number }).learned_boost) || 0;
      }
    }
  }
  return NextResponse.json({ boosts });
}
