import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_PROFILE, parseUserProfile } from "@/lib/onboardingProfile";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getVerifiedUserId } from "@/lib/server/verifiedSession";

export const dynamic = "force-dynamic";

function missingProfileColumn(message: string | undefined): boolean {
  const msg = String(message ?? "");
  return msg.includes("user_profile") && msg.includes("column");
}

export async function GET(req: NextRequest) {
  const userId = await getVerifiedUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

  const { data, error } = await supabase.from("users").select("id, user_profile").eq("id", userId).maybeSingle();
  if (error) {
    if (missingProfileColumn(error.message)) {
      const fallback = await supabase.from("users").select("id").eq("id", userId).maybeSingle();
      if (fallback.error) {
        console.error("[profile] fallback read failed", fallback.error.code);
        return NextResponse.json({ ok: false, error: "failed_to_load_profile" }, { status: 500 });
      }
      if (fallback.data?.id) {
        return NextResponse.json({
          ok: true,
          user_id: fallback.data.id,
          user_profile: DEFAULT_USER_PROFILE,
          warning: "missing_user_profile_column",
        });
      }
    }
    console.error("[profile] read failed", error.code);
    return NextResponse.json({ ok: false, error: "failed_to_load_profile" }, { status: 500 });
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
  const userId = await getVerifiedUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
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
    if (missingProfileColumn(error.message)) {
      const fallback = await supabase
        .from("users")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (!fallback.error) {
        const res = NextResponse.json({
          ok: true,
          user_profile: nextProfile,
          persisted: false,
          warning: "missing_user_profile_column",
        });
        res.cookies.set("hama_is_new_user", "0", {
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
          sameSite: "lax",
        });
        return res;
      }
      console.error("[profile] fallback write failed", fallback.error.code);
    }
    console.error("[profile] write failed", error.code);
    return NextResponse.json({ ok: false, error: "failed_to_save_profile" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, user_profile: nextProfile });
  res.cookies.set("hama_is_new_user", "0", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });
  return res;
}
