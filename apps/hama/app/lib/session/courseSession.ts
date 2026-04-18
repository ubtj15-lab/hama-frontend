import type { CoursePlan } from "@/lib/scenarioEngine/types";

const KEY = (id: string) => `hama_course_${id}`;

/** 브라우저·탭 간에도 동일 출처에서 복원 가능하도록 session + local 동시 저장 */
export function stashCoursePlan(plan: CoursePlan): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(plan);
  try {
    sessionStorage.setItem(KEY(plan.id), raw);
  } catch {}
  try {
    localStorage.setItem(KEY(plan.id), raw);
  } catch {}
}

export function encodeCoursePlanSnapshot(plan: CoursePlan): string {
  const json = JSON.stringify(plan);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeCoursePlanSnapshot(b64: string): CoursePlan | null {
  try {
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const b64norm = b64.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const json = decodeURIComponent(escape(atob(b64norm)));
    const p = JSON.parse(json) as CoursePlan;
    return p?.id && Array.isArray(p.stops) ? p : null;
  } catch {
    return null;
  }
}

export type CourseRestoreSource = "session" | "local" | "query_snap" | "hash_snap";

export type CourseRestoreResult = {
  plan: CoursePlan | null;
  source: CourseRestoreSource | null;
};

/**
 * 1) sessionStorage 2) localStorage 3) URL query courseSnap 4) hash #hamaCourseSnap=
 */
export function readCoursePlanWithFallback(
  id: string,
  opts?: { courseSnapB64?: string | null; hashSnapB64?: string | null }
): CourseRestoreResult {
  if (typeof window === "undefined") return { plan: null, source: null };
  const key = KEY(id);
  try {
    const s = sessionStorage.getItem(key);
    if (s) {
      const p = JSON.parse(s) as CoursePlan;
      if (p?.id === id && p.stops?.length) return { plan: p, source: "session" };
    }
  } catch {}
  try {
    const s = localStorage.getItem(key);
    if (s) {
      const p = JSON.parse(s) as CoursePlan;
      if (p?.id === id && p.stops?.length) return { plan: p, source: "local" };
    }
  } catch {}
  const snap = opts?.courseSnapB64?.trim();
  if (snap) {
    const p = decodeCoursePlanSnapshot(snap);
    if (p?.id === id && p.stops?.length) return { plan: p, source: "query_snap" };
  }
  const hs = opts?.hashSnapB64?.trim();
  if (hs) {
    const p = decodeCoursePlanSnapshot(hs);
    if (p?.id === id && p.stops?.length) return { plan: p, source: "hash_snap" };
  }
  return { plan: null, source: null };
}

/** @deprecated readCoursePlanWithFallback 사용 권장 */
export function readCoursePlanFromSession(id: string): CoursePlan | null {
  return readCoursePlanWithFallback(id).plan;
}
