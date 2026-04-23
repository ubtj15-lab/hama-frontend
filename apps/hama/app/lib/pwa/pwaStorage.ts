/** PWA 설치/안내 — 로컬 전용, 분석·서버로 보내지 않음 */

export const PWA_STORAGE = {
  /** "나중에" / 닫기 후 재노출 시각 (ISO) */
  SNOOZE_UNTIL: "hama_pwa_snooze_until",
  /** 안내 UI를 연 횟수 (상한으로 과도한 노출 방지) */
  SHOWN_COUNT: "hama_pwa_prompt_shown_count",
  /** 브라우저 탭(세션)마다 1회만 올리는 방문 누적 (새 탭/재방문) */
  SESSION_OPENS: "hama_pwa_session_opens",
  /** 추천/코스 등 의미 있는 액션 1회 이상 */
  ENGAGED: "hama_pwa_ever_engaged",
} as const;

const MAX_AUTO_PROMPTS = 3;
const SNOOZE_DAYS = 7;
const ELIGIBLE_SESSION_OPENS = 2;
const SHOW_DELAY_MS = 5500;

export function readSnoozeUntil(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(PWA_STORAGE.SNOOZE_UNTIL);
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

export function isSnoozing(): boolean {
  return readSnoozeUntil() > Date.now();
}

export function snoozeInstallPrompt(): void {
  const until = new Date();
  until.setDate(until.getDate() + SNOOZE_DAYS);
  localStorage.setItem(PWA_STORAGE.SNOOZE_UNTIL, until.toISOString());
}

export function getPromptShownCount(): number {
  if (typeof window === "undefined") return 0;
  return Math.max(0, parseInt(localStorage.getItem(PWA_STORAGE.SHOWN_COUNT) || "0", 10) || 0);
}

export function incrementPromptShownCount(): void {
  if (typeof window === "undefined") return;
  const n = (parseInt(localStorage.getItem(PWA_STORAGE.SHOWN_COUNT) || "0", 10) || 0) + 1;
  localStorage.setItem(PWA_STORAGE.SHOWN_COUNT, String(n));
}

export function atPromptLimit(): boolean {
  return getPromptShownCount() >= MAX_AUTO_PROMPTS;
}

/** 새 브라우저 세션마다 1회 증가 (탭 단위) */
export function maybeIncrementSessionOpen(): void {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem("hama_pwa_counted")) return;
  sessionStorage.setItem("hama_pwa_counted", "1");
  const n = (parseInt(localStorage.getItem(PWA_STORAGE.SESSION_OPENS) || "0", 10) || 0) + 1;
  localStorage.setItem(PWA_STORAGE.SESSION_OPENS, String(n));
}

export function getSessionOpenCount(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(PWA_STORAGE.SESSION_OPENS) || "0", 10) || 0;
}

export function markPwaEngagement(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PWA_STORAGE.ENGAGED, "1");
}

export function hasPwaEngagement(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PWA_STORAGE.ENGAGED) === "1";
}

export { ELIGIBLE_SESSION_OPENS, MAX_AUTO_PROMPTS, SHOW_DELAY_MS, SNOOZE_DAYS };
