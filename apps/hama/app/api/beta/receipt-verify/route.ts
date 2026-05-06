import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { resolveUserIdFromRequest } from "@/lib/server/userResolver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function normalizeName(v: string | null | undefined): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function namesMatched(selectedName: string | null | undefined, receiptName: string | null | undefined) {
  const a = normalizeName(selectedName);
  const b = normalizeName(receiptName);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function parseFeedbackTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn("[receipt verify failed]", {
      reason: "supabase_unavailable",
      status: 500,
      errorMessage: "getSupabaseAdmin returned null",
    });
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    console.warn("[receipt verify failed]", {
      reason: "invalid_form_data",
      status: 400,
      errorMessage: "failed to parse formData",
    });
    return NextResponse.json({ ok: false, error: "invalid_form_data" }, { status: 400 });
  }

  const userId = await resolveUserIdFromRequest(req, String(form.get("user_id") ?? "").trim() || null);
  if (!userId) {
    console.warn("[receipt verify failed]", {
      reason: "unauthorized",
      status: 401,
      errorMessage: "userId not resolved from request",
    });
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const selectedPlaceLogId = String(form.get("selected_place_log_id") ?? "").trim();
  const receiptPlaceName = String(form.get("receipt_place_name") ?? "").trim();
  const receiptImage = form.get("receipt_image");
  const feedbackTags = parseFeedbackTags(form.get("feedback_tags"));
  const feedbackTextRaw = form.get("feedback_text");
  const feedbackText =
    typeof feedbackTextRaw === "string" && feedbackTextRaw.trim().length > 0
      ? feedbackTextRaw.trim().slice(0, 500)
      : null;
  console.log("[receipt verify request]", {
    hasUser: Boolean(userId),
    userId: userId ?? null,
    storeId: selectedPlaceLogId || null,
    storeName: receiptPlaceName || null,
    hasFile: receiptImage instanceof File,
    hasImageUrl: false,
    payloadKeys: Array.from(form.keys()),
  });

  if (!selectedPlaceLogId) {
    console.warn("[receipt verify failed]", {
      reason: "selected_place_log_id_required",
      status: 400,
      errorMessage: "selected_place_log_id missing",
    });
    return NextResponse.json({ ok: false, error: "selected_place_log_id_required" }, { status: 400 });
  }
  if (!receiptPlaceName) {
    console.warn("[receipt verify failed]", {
      reason: "receipt_place_name_required",
      status: 400,
      errorMessage: "receipt_place_name missing",
    });
    return NextResponse.json({ ok: false, error: "receipt_place_name_required" }, { status: 400 });
  }
  if (!(receiptImage instanceof File)) {
    console.warn("[receipt verify failed]", {
      reason: "receipt_image_required",
      status: 400,
      errorMessage: "receipt_image missing or not File",
    });
    return NextResponse.json({ ok: false, error: "receipt_image_required" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(receiptImage.type)) {
    console.warn("[receipt verify failed]", {
      reason: "invalid_file_type",
      status: 400,
      errorMessage: `mime=${receiptImage.type}`,
    });
    return NextResponse.json({ ok: false, error: "invalid_file_type" }, { status: 400 });
  }
  if (receiptImage.size <= 0 || receiptImage.size > MAX_FILE_BYTES) {
    console.warn("[receipt verify failed]", {
      reason: "invalid_file_size",
      status: 400,
      errorMessage: `size=${receiptImage.size}`,
    });
    return NextResponse.json({ ok: false, error: "invalid_file_size" }, { status: 400 });
  }

  try {
    const selectedDecision = await supabase
      .from("selected_place_logs")
      .select("id,place_id,place_name,created_at")
      .eq("user_id", userId)
      .eq("id", selectedPlaceLogId)
      .maybeSingle();

    if (selectedDecision.error) {
      console.warn("[receipt verify failed]", {
        reason: "selected_place_read_failed",
        status: 200,
        errorMessage: selectedDecision.error.message,
      });
      return NextResponse.json(
        { ok: false, error: "selected_place_read_failed", detail: selectedDecision.error.message },
        { status: 200 }
      );
    }
    if (!selectedDecision.data) {
      console.warn("[receipt verify failed]", {
        reason: "selected_place_not_found",
        status: 200,
        errorMessage: "no selected_place_logs row",
      });
      return NextResponse.json({ ok: false, error: "selected_place_not_found" }, { status: 200 });
    }

    const selected = selectedDecision.data;
    const matched = namesMatched(selected.place_name, receiptPlaceName);
    const status = "pending";
    const ext =
      receiptImage.type === "image/jpeg"
        ? "jpg"
        : receiptImage.type === "image/png"
        ? "png"
        : "webp";
    const nonce =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    const storagePath = `receipts/${userId}/${Date.now()}-${nonce}.${ext}`;
    const bytes = Buffer.from(await receiptImage.arrayBuffer());
    const upload = await supabase.storage
      .from("receipt-images")
      .upload(storagePath, bytes, {
        contentType: receiptImage.type,
        upsert: false,
      });
    if (upload.error) {
      console.warn("[receipt verify failed]", {
        reason: "storage_upload_failed",
        status: 500,
        errorMessage: upload.error.message,
      });
      return NextResponse.json(
        { ok: false, error: "storage_upload_failed", detail: upload.error.message },
        { status: 500 }
      );
    }

    const inserted = await supabase
      .from("receipt_verifications")
      .insert({
        user_id: userId,
        selected_place_id: selected.place_id,
        receipt_image_url: storagePath,
        receipt_place_name: receiptPlaceName,
        feedback_tags: feedbackTags,
        feedback_text: feedbackText,
        matched,
        status,
      })
      .select("id")
      .single();
    if (inserted.error) {
      console.warn("[receipt verify failed]", {
        reason: "receipt_verification_insert_failed",
        status: 200,
        errorMessage: inserted.error.message,
      });
      return NextResponse.json(
        { ok: false, error: "receipt_verification_insert_failed", detail: inserted.error.message },
        { status: 200 }
      );
    }

    console.log("receipt_verification_submitted", {
      selected_place_id: selected.place_id,
      selected_place_log_id: selectedPlaceLogId,
      selected_place_name: selected.place_name,
      receipt_place_name: receiptPlaceName,
      feedback_tags: feedbackTags,
      feedback_text: feedbackText,
      matched,
      status,
      receipt_image_path: storagePath,
    });
    console.log("[receipt verify success]", {
      verificationId: inserted.data?.id ?? null,
      storeId: selected.place_id ?? null,
      userId,
    });

    return NextResponse.json({
      ok: true,
      status,
      matched,
      selected_place: selected,
      selected_place_log_id: selectedPlaceLogId,
      message: "인증이 제출됐어요. 관리자가 확인 후 참여 횟수에 반영돼요.",
    });
  } catch (e) {
    console.error("[beta receipt verify] fatal", e);
    console.warn("[receipt verify failed]", {
      reason: "unexpected_error",
      status: 500,
      errorMessage: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
