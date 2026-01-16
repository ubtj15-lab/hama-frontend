import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") || "all";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // ✅ 1) 환경변수 확인 로그
    console.log("[home-recommend] tab:", tab);
    console.log("[home-recommend] hasUrl:", !!supabaseUrl);
    console.log("[home-recommend] hasAnonKey:", !!supabaseAnonKey);

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { items: [], error: "missing_env" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // ✅ 2) supabase 호출 + 에러 상세 로그
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .limit(30);

    if (error) {
      console.error("[home-recommend] supabase error:", error);
      return NextResponse.json(
        { items: [], error: "supabase_select_failed", detail: error.message },
        { status: 500 }
      );
    }

    const stores = (data ?? []).filter((s: any) => {
      if (tab === "all") return true;
      return s?.category === tab;
    });

    return NextResponse.json({ items: stores }, { status: 200 });
  } catch (e: any) {
    console.error("[home-recommend] unexpected error:", e);
    return NextResponse.json(
      { items: [], error: "failed_to_load", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
