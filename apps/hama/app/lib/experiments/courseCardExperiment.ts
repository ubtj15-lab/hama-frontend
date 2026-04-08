import { getOrCreateSessionId } from "@hama/shared";

const STORAGE_KEY = "hama_exp_course_card_ab";

export type CourseCardExperimentGroup = "A" | "B";

function hashSessionToGroup(sessionId: string): CourseCardExperimentGroup {
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) h = (h * 31 + sessionId.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? "A" : "B";
}

/**
 * 코스 카드 A/B (기능 설명형 vs 상황·감정형).
 * 세션 ID 기반으로 일관 할당, `?courseCardAB=A|B` 로 오버라이드(개발·QA).
 */
export function getCourseCardExperimentGroup(): CourseCardExperimentGroup {
  if (typeof window === "undefined") return "B";
  try {
    const param = new URLSearchParams(window.location.search).get("courseCardAB");
    if (param === "A" || param === "B") {
      localStorage.setItem(STORAGE_KEY, param);
      if (process.env.NODE_ENV === "development") {
        (window as unknown as { __HAMA_COURSE_CARD_AB__?: string }).__HAMA_COURSE_CARD_AB__ = param;
      }
      return param;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "A" || stored === "B") {
      if (process.env.NODE_ENV === "development") {
        (window as unknown as { __HAMA_COURSE_CARD_AB__?: string }).__HAMA_COURSE_CARD_AB__ = stored;
      }
      return stored;
    }
    const sid = getOrCreateSessionId();
    const g = hashSessionToGroup(sid || `rnd_${Math.random()}`);
    localStorage.setItem(STORAGE_KEY, g);
    if (process.env.NODE_ENV === "development") {
      (window as unknown as { __HAMA_COURSE_CARD_AB__?: string }).__HAMA_COURSE_CARD_AB__ = g;
    }
    return g;
  } catch {
    return "B";
  }
}
