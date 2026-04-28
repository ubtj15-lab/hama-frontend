import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { resolveUserIdFromRequest } from "@/lib/server/userResolver";

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

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

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

  const selectedPlaceLogId = String(form.get("selected_place_log_id") ?? "").trim();
  const receiptPlaceName = String(form.get("receipt_place_name") ?? "").trim();
  const receiptImage = form.get("receipt_image");

  if (!selectedPlaceLogId) {
    return NextResponse.json({ ok: false, error: "selected_place_log_id_required" }, { status: 400 });
  }
  if (!receiptPlaceName) {
    return NextResponse.json({ ok: false, error: "receipt_place_name_required" }, { status: 400 });
  }
  if (!(receiptImage instanceof File)) {
    return NextResponse.json({ ok: false, error: "receipt_image_required" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(receiptImage.type)) {
    return NextResponse.json({ ok: false, error: "invalid_file_type" }, { status: 400 });
  }
  if (receiptImage.size <= 0 || receiptImage.size > MAX_FILE_BYTES) {
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
      return NextResponse.json(
        { ok: false, error: "selected_place_read_failed", detail: selectedDecision.error.message },
        { status: 200 }
      );
    }
    if (!selectedDecision.data) {
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
      return NextResponse.json(
        { ok: false, error: "storage_upload_failed", detail: upload.error.message },
        { status: 500 }
      );
    }

    const inserted = await supabase.from("receipt_verifications").insert({
      user_id: userId,
      selected_place_id: selected.place_id,
      receipt_image_url: storagePath,
      receipt_place_name: receiptPlaceName,
      matched,
      status,
    });
    if (inserted.error) {
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
      matched,
      status,
      receipt_image_path: storagePath,
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
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
