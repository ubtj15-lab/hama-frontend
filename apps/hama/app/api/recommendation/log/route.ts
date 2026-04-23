import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

type Body = {
  session_id: string;
  user_id?: string | null;
  event_name: string;
  entity_type?: string | null;
  entity_id?: string | null;
  scenario?: string | null;
  child_age_group?: string | null;
  weather_condition?: string | null;
  time_of_day?: string | null;
  date_time_band?: string | null;
  rank_position?: number | null;
  source_page?: string | null;
  template_id?: string | null;
  step_pattern?: string | null;
  place_ids?: string[];
  metadata?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const supabase = getSupabase();
    if (supabase) {
      const row = {
        session_id: body.session_id ?? "unknown",
        user_id: body.user_id ?? null,
        event_name: body.event_name,
        entity_type: body.entity_type ?? null,
        entity_id: body.entity_id ?? null,
        scenario: body.scenario ?? null,
        child_age_group: body.child_age_group ?? null,
        weather_condition: body.weather_condition ?? null,
        time_of_day: body.time_of_day ?? null,
        date_time_band: body.date_time_band ?? null,
        rank_position: body.rank_position ?? null,
        source_page: body.source_page ?? null,
        template_id: body.template_id ?? null,
        step_pattern: body.step_pattern ?? null,
        place_ids: body.place_ids ?? [],
        metadata: body.metadata ?? {},
      };
      const { error } = await supabase.from("recommendation_events").insert(row);
      if (error) console.error("recommendation_events insert:", error);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("recommendation log", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
