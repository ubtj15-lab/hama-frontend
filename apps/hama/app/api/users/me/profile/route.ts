import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_USER_PROFILE, parseUserProfile } from "@/lib/onboardingProfile";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as
    | string
    | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function getUserId(req: NextRequest): string | null {
  return req.cookies.get("hama_user_id")?.value ?? null;
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  const supabase = getSupabase();
  if (!userId || !supabase) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.from("users").select("id, user_profile").eq("id", userId).single();
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("user_profile") && msg.includes("column")) {
      const fallback = await supabase.from("users").select("id").eq("id", userId).single();
      if (fallback.data?.id) {
        return NextResponse.json({
          ok: true,
          user_id: fallback.data.id,
          user_profile: DEFAULT_USER_PROFILE,
          warning: "missing_user_profile_column",
        });
      }
    }
    return NextResponse.json(
      { ok: false, error: "failed_to_load_profile", detail: error.message },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    user_id: data.id,
    user_profile: parseUserProfile(data.user_profile),
  });
}

export async function PUT(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const bodyUserId = typeof bodyObj.user_id === "string" ? bodyObj.user_id : null;
  const userId = getUserId(req) ?? bodyUserId;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = parseUserProfile(body);
  const nextProfile = {
    ...parsed,
    onboarding_completed_at: parsed.onboarding_completed_at ?? new Date().toISOString(),
  };
  const { error } = await supabase
    .from("users")
    .update({
      user_profile: nextProfile,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("user_profile") && msg.includes("column")) {
      const fallback = await supabase
        .from("users")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (!fallback.error) {
        return NextResponse.json({
          ok: true,
          user_profile: nextProfile,
          persisted: false,
          warning: "missing_user_profile_column",
        });
      }
    }
    return NextResponse.json(
      { ok: false, error: "failed_to_save_profile", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, user_profile: nextProfile });
}
