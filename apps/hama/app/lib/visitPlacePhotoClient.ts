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
