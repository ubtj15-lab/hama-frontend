/**
 * 방문 사진 업로드 강제 진단 (console + API debug).
 * - 프로덕션 기본 OFF (`NODE_ENV === "production"`).
 * - Vercel 프로덕션 빌드에서도 켜려면 `HAMA_VISIT_PHOTO_DIAG=true`.
 * - 끄려면 `HAMA_VISIT_PHOTO_DIAG=0`.
 */
export function shouldDiagVisitPhoto(): boolean {
  const v = process.env.HAMA_VISIT_PHOTO_DIAG?.trim().toLowerCase();
  if (v === "0" || v === "false") return false;
  if (v === "1" || v === "true") return true;
  return process.env.NODE_ENV !== "production";
}
