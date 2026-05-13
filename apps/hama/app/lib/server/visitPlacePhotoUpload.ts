import type { SupabaseClient } from "@supabase/supabase-js";

export const VISIT_PLACE_PHOTO_BUCKET = "user-place-photos";
export const VISIT_PLACE_PHOTO_MAX_FILES = 3;
export const VISIT_PLACE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const VISIT_PLACE_PHOTO_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export function parseVisitPhotoFilesFromForm(form: FormData): File[] {
  const out: File[] = [];
  for (let i = 0; i < VISIT_PLACE_PHOTO_MAX_FILES; i++) {
    const v = form.get(`visit_photo_${i}`);
    if (v instanceof File && v.size > 0) out.push(v);
  }
  return out.slice(0, VISIT_PLACE_PHOTO_MAX_FILES);
}

export function isValidVisitPlacePhotoFile(file: File): boolean {
  return (
    VISIT_PLACE_PHOTO_ALLOWED_MIME.has(file.type) &&
    file.size > 0 &&
    file.size <= VISIT_PLACE_PHOTO_MAX_BYTES
  );
}

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export type PersistVisitPlacePhotosParams = {
  userId: string;
  storeId: string;
  storeName: string | null;
  receiptVerificationId: string | null;
  visitFeedbackId: string | null;
  source: "receipt_verification" | "visit_feedback";
};

export async function persistVisitPlacePhotos(
  supabase: SupabaseClient,
  rawFiles: File[],
  params: PersistVisitPlacePhotosParams
): Promise<{ uploaded: number; failed: number }> {
  const toProcess = rawFiles.slice(0, VISIT_PLACE_PHOTO_MAX_FILES);
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const file = toProcess[i]!;
    if (!isValidVisitPlacePhotoFile(file)) {
      failed += 1;
      continue;
    }
    const ext = extFromMime(file.type);
    const nonce =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    const storagePath = `${params.userId}/${params.storeId}/${Date.now()}-${nonce}-${i}.${ext}`;
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch {
      failed += 1;
      continue;
    }
    const up = await supabase.storage
      .from(VISIT_PLACE_PHOTO_BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });
    if (up.error) {
      failed += 1;
      continue;
    }
    const ins = await supabase.from("user_place_photos").insert({
      user_id: params.userId,
      receipt_verification_id: params.receiptVerificationId,
      visit_feedback_id: params.visitFeedbackId,
      photo_storage_path: storagePath,
      store_id: params.storeId,
      store_name: params.storeName,
      source: params.source,
      status: "pending",
      metadata: {},
    });
    if (ins.error) {
      failed += 1;
      await supabase.storage.from(VISIT_PLACE_PHOTO_BUCKET).remove([storagePath]);
      continue;
    }
    uploaded += 1;
  }
  return { uploaded, failed };
}
