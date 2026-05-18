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

/** 카카오톡 인앱 브라우저 — beforeinstallprompt 미지원 */
export function isKakaoInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return /KAKAOTALK/i.test(navigator.userAgent);
}

/** iOS·Safari·카카오 인앱 등 수동 '홈 화면에 추가' 안내가 필요한 환경 */
export function needsManualHomeScreenGuide(): boolean {
  return isIosBrowser() || isKakaoInAppBrowser();
}
