import { isOnboardingCompleted, parseUserProfile, type UserProfile } from "@/lib/onboardingProfile";

export const ONBOARDING_COMPLETED_AT_LS = "hama_onboarding_completed_at";
export const ONBOARDING_PROFILE_PENDING_LS = "hama_user_profile_pending";
export const ONBOARDING_PROMPT_DISMISSED_KEY = "hama_onboarding_prompt_dismissed";
export const NEW_USER_COOKIE = "hama_is_new_user";
/** @deprecated 로그인 판별은 `/api/me` (httpOnly `hama_user_id` 쿠키) 사용 */
export const LOGIN_FLAG_KEY = "hamaLoggedIn";

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/** @deprecated `/api/me` 사용 — `hama_user_id`는 httpOnly라 document.cookie로 읽을 수 없음 */
export function isLoggedInForSurveyGate(): boolean {
  return false;
}

export function readLocalOnboardingCompletedAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const direct = window.localStorage.getItem(ONBOARDING_COMPLETED_AT_LS);
    if (typeof direct === "string" && direct.length > 0) return direct;
    const pendingRaw = window.localStorage.getItem(ONBOARDING_PROFILE_PENDING_LS);
    if (pendingRaw) {
      const pending = parseUserProfile(JSON.parse(pendingRaw));
      if (pending.onboarding_completed_at) return pending.onboarding_completed_at;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** 서버 저장 성공 직후에만 호출 — 설문 완료 로컬 확정 */
export function markOnboardingCompletedLocally(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  const at =
    typeof profile.onboarding_completed_at === "string" && profile.onboarding_completed_at.length > 0
      ? profile.onboarding_completed_at
      : new Date().toISOString();
  try {
    window.localStorage.setItem(ONBOARDING_COMPLETED_AT_LS, at);
    window.localStorage.removeItem(ONBOARDING_PROFILE_PENDING_LS);
    window.localStorage.setItem(ONBOARDING_PROMPT_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
  clearNewUserCookie();
}

export function clearNewUserCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${NEW_USER_COOKIE}=0; path=/; max-age=0; SameSite=Lax`;
}

export function isSurveyCompletedResolved(serverProfile: UserProfile | null | undefined): boolean {
  if (isOnboardingCompleted(serverProfile)) return true;
  return Boolean(readLocalOnboardingCompletedAt());
}

export function isKakaoInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /KAKAOTALK/i.test(navigator.userAgent);
}

export function logSurveyGate(payload: Record<string, unknown>): void {
  console.log("[HAMA_SURVEY_GATE]", payload);
}

export function logSurveyComplete(payload: Record<string, unknown>): void {
  console.log("[HAMA_SURVEY_COMPLETE]", payload);
}

export function logSurveyRedirect(payload: Record<string, unknown>): void {
  console.log("[HAMA_SURVEY_REDIRECT]", payload);
}
