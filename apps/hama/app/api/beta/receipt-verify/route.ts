import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getUserIdFromAuthCookie } from "@/lib/server/userResolver";
import {
  formHasVisitPhotoKeys,
  parseVisitPhotoFilesFromForm,
  persistVisitPlacePhotos,
} from "@/lib/server/visitPlacePhotoUpload";
import { shouldDiagVisitPhoto } from "@/lib/visitPhotoDiag";

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
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form_data" }, { status: 400 });
  }

  if (shouldDiagVisitPhoto()) {
    const vp0 = form.get("visit_photo_0");
    const b0 = vp0 instanceof Blob ? vp0 : null;
    console.log("[HAMA_VISIT_PHOTO_SERVER_FORMDATA]", {
      route: "receipt-verify",
      keys: Array.from(form.keys()),
      hasVisitPhoto0: form.has("visit_photo_0"),
      visitPhoto0Type: vp0?.constructor?.name,
      visitPhoto0Size: b0?.size ?? null,
      visitPhoto0Mime: b0?.type ?? null,
    });
  }

  const userId = getUserIdFromAuthCookie(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "LOGIN_REQUIRED" }, { status: 401 });
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
  const { parts: visitPhotoParts, errors: visitPhotoParseErrors } = parseVisitPhotoFilesFromForm(form);

  if (!selectedPlaceLogId) {
    return NextResponse.json({ ok: false, error: "selected_place_log_id_required" }, { status: 400 });
  }
  if (!receiptPlaceName) {
    return NextResponse.json({ ok: false, error: "receipt_place_name_required" }, { status: 400 });
  }
  if (!(receiptImage instanceof Blob) || receiptImage.size <= 0) {
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
      return NextResponse.json(
        { ok: false, error: "receipt_verification_insert_failed", detail: inserted.error.message },
        { status: 200 }
      );
    }

    const verificationId = inserted.data?.id ? String(inserted.data.id) : null;

    const visitPhotoPersistErrors: string[] = [];
    let visitUploaded = 0;
    if (verificationId && visitPhotoParts.length > 0) {
      const r = await persistVisitPlacePhotos(supabase, visitPhotoParts, {
        userId,
        storeId: String(selected.place_id ?? ""),
        storeName: receiptPlaceName,
        receiptVerificationId: verificationId,
        visitFeedbackId: null,
        source: "receipt_verification",
      });
      visitUploaded = r.uploaded;
      visitPhotoPersistErrors.push(...r.errors);
    }

    const visitPhotoOrphanNote: string[] = [];
    if (formHasVisitPhotoKeys(form) && visitPhotoParts.length === 0 && visitPhotoParseErrors.length === 0) {
      visitPhotoOrphanNote.push(
        "visit_photo_* 키는 있으나 유효한 이미지 Blob을 읽지 못했습니다. 브라우저·프록시에서 multipart가 변형됐는지 확인해 주세요."
      );
    }

    const visitErrors = [...visitPhotoParseErrors, ...visitPhotoPersistErrors, ...visitPhotoOrphanNote];
    const visit_photosBase = {
      uploaded: visitUploaded,
      failed: visitErrors.length,
      errors: visitErrors,
    };
    const visit_photos = shouldDiagVisitPhoto()
      ? {
          ...visit_photosBase,
          debug: {
            formKeys: Array.from(form.keys()),
            parsedPhotoCount: visitPhotoParts.length,
            uploadAttempted: Boolean(verificationId && visitPhotoParts.length > 0),
            insertedRows: visitUploaded,
          },
        }
      : visit_photosBase;

    return NextResponse.json({
      ok: true,
      status,
      matched,
      selected_place: selected,
      selected_place_log_id: selectedPlaceLogId,
      message: "인증이 제출됐어요. 관리자가 확인 후 참여 횟수에 반영돼요.",
      visit_photos,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
