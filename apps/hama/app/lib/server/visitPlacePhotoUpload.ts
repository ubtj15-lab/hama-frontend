import type { SupabaseClient } from "@supabase/supabase-js";
import { shouldDiagVisitPhoto } from "@/lib/visitPhotoDiag";

export const VISIT_PLACE_PHOTO_BUCKET = "user-place-photos";
export const VISIT_PLACE_PHOTO_MAX_FILES = 3;
export const VISIT_PLACE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const VISIT_PLACE_PHOTO_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function isBlobPart(v: FormDataEntryValue | null): boolean {
  return typeof Blob !== "undefined" && v != null && typeof v === "object" && v instanceof Blob;
}

/**
 * multipart `visit_photo_0` … `visit_photo_2` 파싱.
 * Node/Undici 환경에서 `instanceof File`이 false인 Blob 파트도 수용합니다.
 */
export function parseVisitPhotoFilesFromForm(form: FormData): { parts: Blob[]; errors: string[] } {
  const errors: string[] = [];
  const parts: Blob[] = [];

  for (let i = 0; i < VISIT_PLACE_PHOTO_MAX_FILES; i++) {
    const key = `visit_photo_${i}`;
    const v = form.get(key);
    if (v === null) continue;

    if (typeof v === "string") {
      if (v.length > 0) {
        errors.push(`${key}: 파일이 필요한데 문자열이 전달됐어요.`);
      }
      continue;
    }

    if (!isBlobPart(v)) {
      errors.push(`${key}: 알 수 없는 형식입니다.`);
      continue;
    }

    const blob = v as Blob;

    if (blob.size <= 0) {
      errors.push(`${key}: 빈 파일입니다.`);
      continue;
    }

    if (blob.size > VISIT_PLACE_PHOTO_MAX_BYTES) {
      errors.push(`${key}: 5MB를 초과했습니다.`);
      continue;
    }

    const mime = blob.type || "";
    if (!VISIT_PLACE_PHOTO_ALLOWED_MIME.has(mime)) {
      errors.push(`${key}: 허용되지 않는 형식입니다 (${mime || "mime 없음"}). jpg/png/webp만 가능해요.`);
      continue;
    }

    parts.push(blob);
  }

  return { parts: parts.slice(0, VISIT_PLACE_PHOTO_MAX_FILES), errors };
}

export function formHasVisitPhotoKeys(form: FormData): boolean {
  for (const k of Array.from(form.keys())) {
    if (k.startsWith("visit_photo_")) return true;
  }
  return false;
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
  parts: Blob[],
  params: PersistVisitPlacePhotosParams
): Promise<{ uploaded: number; errors: string[] }> {
  const toProcess = parts.slice(0, VISIT_PLACE_PHOTO_MAX_FILES);
  let uploaded = 0;
  const errors: string[] = [];
  const diag = shouldDiagVisitPhoto();

  if (diag) {
    console.log("[HAMA_VISIT_PHOTO_UPLOAD_START]", {
      partCount: toProcess.length,
      bucketName: VISIT_PLACE_PHOTO_BUCKET,
      userId: params.userId,
      storeId: params.storeId,
      source: params.source,
    });
  }

  for (let i = 0; i < toProcess.length; i++) {
    const blob = toProcess[i]!;
    const label = `visit_photo_${i}`;
    const ext = extFromMime(blob.type);
    const nonce =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    const storagePath = `${params.userId}/${params.storeId}/${Date.now()}-${nonce}-${i}.${ext}`;
    const filename = typeof File !== "undefined" && blob instanceof File ? blob.name : "";

    if (diag) {
      console.log("[HAMA_VISIT_PHOTO_UPLOAD_ONE]", {
        phase: "before_storage",
        index: i,
        filename,
        mime: blob.type,
        size: blob.size,
        storagePath,
      });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(await blob.arrayBuffer());
    } catch (readErr) {
      const msg = readErr instanceof Error ? readErr.message : String(readErr);
      errors.push(`${label}: 파일 읽기에 실패했어요.`);
      if (diag) {
        console.error("[HAMA_VISIT_PHOTO_UPLOAD_ERROR]", {
          index: i,
          storagePath,
          phase: "arrayBuffer",
          message: msg,
          details: readErr,
        });
      }
      continue;
    }

    const up = await supabase.storage
      .from(VISIT_PLACE_PHOTO_BUCKET)
      .upload(storagePath, buffer, { contentType: blob.type || "application/octet-stream", upsert: false });

    if (up.error) {
      errors.push(
        `${label}: 스토리지 업로드 실패 (${VISIT_PLACE_PHOTO_BUCKET}) — ${up.error.message}. 버킷 생성·권한을 확인해 주세요.`
      );
      if (diag) {
        console.error("[HAMA_VISIT_PHOTO_UPLOAD_ERROR]", {
          index: i,
          storagePath,
          phase: "storage_upload",
          message: up.error.message,
          details: up.error,
        });
      }
      continue;
    }

    const insertPayload = {
      user_id: params.userId,
      receipt_verification_id: params.receiptVerificationId,
      visit_feedback_id: params.visitFeedbackId,
      photo_storage_path: storagePath,
      store_id: params.storeId,
      store_name: params.storeName,
      source: params.source,
      status: "pending" as const,
      metadata: {},
    };

    const ins = await supabase.from("user_place_photos").insert(insertPayload);

    if (ins.error) {
      errors.push(`${label}: DB 저장 실패 — ${ins.error.message}`);
      if (diag) {
        console.error("[HAMA_VISIT_PHOTO_DB_ERROR]", {
          storagePath,
          payload: insertPayload,
          message: ins.error.message,
          details: ins.error,
        });
      }
      await supabase.storage.from(VISIT_PLACE_PHOTO_BUCKET).remove([storagePath]);
      continue;
    }

    uploaded += 1;
    if (diag) {
      console.log("[HAMA_VISIT_PHOTO_UPLOAD_ONE]", {
        phase: "after_db_insert",
        index: i,
        filename,
        mime: blob.type,
        size: blob.size,
        storagePath,
      });
    }
  }

  return { uploaded, errors };
}
