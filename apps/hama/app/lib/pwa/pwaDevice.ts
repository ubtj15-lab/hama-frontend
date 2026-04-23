/**
 * PWA/설치 UI용 디바이스·표시 모드 감지 (클라이언트 전용)
 */

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const anyNav = navigator as Navigator & { standalone?: boolean };
  if (anyNav.standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

export function isMobileViewForPwa(): boolean {
  if (typeof window === "undefined") return false;
  const narrow = window.matchMedia("(max-width: 768px)").matches;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const phoneLike =
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (navigator.maxTouchPoints > 1 && narrow);
  return phoneLike;
}

export function isIosBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
