/** 클라이언트 방문 사진 선택 — 서버 MIME/용량 검증과 동일하게 맞춤 */

export const VISIT_PLACE_PHOTO_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
export const VISIT_PLACE_PHOTO_MAX_FILES = 3;
export const VISIT_PLACE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isClientVisitPlacePhotoFile(file: File): boolean {
  return ALLOWED.has(file.type) && file.size > 0 && file.size <= VISIT_PLACE_PHOTO_MAX_BYTES;
}

export function pickVisitPlacePhotosFromFileList(list: FileList | null): File[] {
  if (!list || list.length === 0) return [];
  const out: File[] = [];
  for (let i = 0; i < list.length && out.length < VISIT_PLACE_PHOTO_MAX_FILES; i++) {
    const f = list.item(i);
    if (f && isClientVisitPlacePhotoFile(f)) out.push(f);
  }
  return out;
}

/** httpOnly가 아닌 `hama_user_id` 쿠키만 읽을 수 있음. 있으면 FormData에 넣어 서버 `resolveUserIdFromRequest`와 맞춤 */
export function appendHamaUserIdToFormData(fd: FormData): void {
  if (typeof document === "undefined") return;
  const m = document.cookie.match(/(?:^|; )hama_user_id=([^;]*)/);
  const raw = m?.[1];
  if (!raw) return;
  const uid = decodeURIComponent(raw).trim();
  if (uid) fd.set("user_id", uid);
}
