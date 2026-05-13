import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { resolveUserIdFromRequest } from "@/lib/server/userResolver";
import {
  parseVisitPhotoFilesFromForm,
  persistVisitPlacePhotos,
} from "@/lib/server/visitPlacePhotoUpload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Satisfaction = "good" | "neutral" | "bad";

function parseFeedbackTagsFromString(raw: string | null): string[] {
  if (!raw || raw.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_form_data" }, { status: 400 });
    }
    const userId = await resolveUserIdFromRequest(req, String(form.get("user_id") ?? "").trim() || null);
    if (!userId) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const placeId = String(form.get("place_id") ?? "").trim();
    const satisfaction = String(form.get("satisfaction") ?? "").trim() as Satisfaction;
    const placeNameRaw = form.get("place_name");
    const placeName =
      typeof placeNameRaw === "string" && placeNameRaw.trim().length > 0 ? placeNameRaw.trim() : null;
    const sourceRaw = form.get("source");
    const source =
      typeof sourceRaw === "string" && sourceRaw.trim().length > 0 ? sourceRaw.trim() : "hama_pay";
    const memoRaw = form.get("memo");
    const memo =
      typeof memoRaw === "string" && memoRaw.trim().length > 0 ? memoRaw.trim().slice(0, 2000) : null;
    const tagsRaw = form.get("feedback_tags");
    const tags =
      typeof tagsRaw === "string" ? parseFeedbackTagsFromString(tagsRaw) : [];
    const visitFiles = parseVisitPhotoFilesFromForm(form);

    if (!placeId) {
      return NextResponse.json({ ok: false, error: "place_id_required" }, { status: 400 });
    }
    if (!satisfaction || !["good", "neutral", "bad"].includes(satisfaction)) {
      return NextResponse.json({ ok: false, error: "invalid_satisfaction" }, { status: 400 });
    }

    try {
      const { data, error } = await supabase
        .from("visit_feedback")
        .insert({
          user_id: userId,
          place_id: placeId,
          place_name: placeName,
          source,
          satisfaction,
          feedback_tags: tags,
          memo,
        })
        .select("id")
        .single();
      if (error) {
        return NextResponse.json({ ok: false, error: "insert_failed", detail: error.message }, { status: 200 });
      }
      const vfId = data?.id ? String(data.id) : null;
      let visitPhotos = { uploaded: 0, failed: 0 };
      if (vfId && visitFiles.length > 0) {
        visitPhotos = await persistVisitPlacePhotos(supabase, visitFiles, {
          userId,
          storeId: placeId,
          storeName: placeName,
          receiptVerificationId: null,
          visitFeedbackId: vfId,
          source: "visit_feedback",
        });
      }
      return NextResponse.json({ ok: true, visit_photos: visitPhotos });
    } catch {
      return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
    }
  }

  let body: {
    user_id?: string | null;
    place_id?: string;
    place_name?: string | null;
    source?: string | null;
    satisfaction?: Satisfaction;
    feedback_tags?: string[] | null;
    memo?: string | null;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const userId = await resolveUserIdFromRequest(req, body.user_id ?? null);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const placeId = String(body.place_id ?? "").trim();
  if (!placeId) {
    return NextResponse.json({ ok: false, error: "place_id_required" }, { status: 400 });
  }

  if (!body.satisfaction || !["good", "neutral", "bad"].includes(body.satisfaction)) {
    return NextResponse.json({ ok: false, error: "invalid_satisfaction" }, { status: 400 });
  }

  try {
    const normalizedTags = Array.isArray(body.feedback_tags)
      ? body.feedback_tags.filter((x): x is string => typeof x === "string")
      : [];
    const normalizedMemo =
      typeof body.memo === "string" && body.memo.trim().length > 0 ? body.memo.trim() : null;

    const row = {
      user_id: userId,
      place_id: placeId,
      place_name: body.place_name ?? null,
      source: body.source ?? "hama_pay",
      satisfaction: body.satisfaction,
      feedback_tags: normalizedTags,
      memo: normalizedMemo,
    };
    const { error } = await supabase.from("visit_feedback").insert(row).select("id").single();
    if (error) {
      return NextResponse.json({ ok: false, error: "insert_failed", detail: error.message }, { status: 200 });
    }
    return NextResponse.json({ ok: true, visit_photos: { uploaded: 0, failed: 0 } });
  } catch {
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
