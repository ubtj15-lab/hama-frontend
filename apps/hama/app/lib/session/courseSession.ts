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

/** 코스 실행 상태 — 예약·진행 UX */
export type CourseLifecyclePhase = "idle" | "confirmed" | "active" | "completed";

export type CourseRunRecord = {
  courseId: string;
  phase: CourseLifecyclePhase;
  /** 더미/추후 PG 연동용 예약 식별자 */
  reservationId: string | null;
  /** 예약이 연결된 코스 단계 (1 = 첫 식당) */
  reservedStepIndex: number;
  /** 현재 진행 정류장 (stops 배열 0 기준) */
  currentStopIndex: number;
  updatedAt: number;
};

const RUN_KEY = (courseId: string) => `hama_course_run_${courseId}`;

function defaultRun(courseId: string): CourseRunRecord {
  return {
    courseId,
    phase: "idle",
    reservationId: null,
    reservedStepIndex: 1,
    currentStopIndex: 0,
    updatedAt: Date.now(),
  };
}

export function readCourseRunRecord(courseId: string): CourseRunRecord {
  if (typeof window === "undefined") return defaultRun(courseId);
  try {
    const s = sessionStorage.getItem(RUN_KEY(courseId));
    if (s) {
      const o = JSON.parse(s) as CourseRunRecord;
      if (o?.courseId === courseId) return { ...defaultRun(courseId), ...o };
    }
  } catch {}
  const legacy = readCourseStepReservationMeta(courseId);
  if (legacy) {
    const step = typeof legacy.stepIndex === "number" && legacy.stepIndex >= 1 ? legacy.stepIndex : 1;
    return {
      ...defaultRun(courseId),
      phase: "confirmed",
      reservationId: legacy.reservationId ?? `legacy_${legacy.completedAt}`,
      reservedStepIndex: step,
      currentStopIndex: 0,
    };
  }
  return defaultRun(courseId);
}

export function writeCourseRunRecord(record: CourseRunRecord): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RUN_KEY(record.courseId), JSON.stringify({ ...record, updatedAt: Date.now() }));
  } catch {}
}

/** 코스 상세 진입 시: 예약 완료(confirmed) 또는 첫 조회(idle) → 실행(active) */
export function syncCourseRunOnCoursePageEntry(courseId: string): void {
  const r = readCourseRunRecord(courseId);
  if (r.phase === "completed") return;
  if (r.phase === "confirmed" || r.phase === "idle") {
    writeCourseRunRecord({ ...r, phase: "active", currentStopIndex: r.phase === "idle" ? 0 : r.currentStopIndex });
  }
}

export function advanceCourseToNextStop(courseId: string, totalStops: number): CourseRunRecord {
  const r = readCourseRunRecord(courseId);
  const nextIdx = r.currentStopIndex + 1;
  if (nextIdx >= totalStops) {
    const done = { ...r, phase: "completed" as const, currentStopIndex: Math.max(0, totalStops - 1) };
    writeCourseRunRecord(done);
    return done;
  }
  const next = { ...r, phase: "active" as const, currentStopIndex: nextIdx };
  writeCourseRunRecord(next);
  return next;
}

/** 코스 1단계 예약 완료 메타(세션) — 예약 후에도 코스 이어 보기용 */
export type CourseStepReservationMeta = {
  courseId: string;
  /** 1 = 첫 단계 식당 예약 */
  stepIndex: number;
  storeId: string;
  timeLabel: string;
  party: number;
  completedAt: number;
  reservationId: string;
};

const RESERVE_META = (courseId: string) => `hama_course_reserve_${courseId}`;

function genReservationId(): string {
  return `hama_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function markCourseStepReservationComplete(
  meta: Omit<CourseStepReservationMeta, "completedAt" | "reservationId"> & { reservationId?: string }
): string {
  if (typeof window === "undefined") return "";
  const reservationId = meta.reservationId ?? genReservationId();
  const full: CourseStepReservationMeta = { ...meta, reservationId, completedAt: Date.now() };
  try {
    sessionStorage.setItem(RESERVE_META(meta.courseId), JSON.stringify(full));
  } catch {}
  const run = readCourseRunRecord(meta.courseId);
  writeCourseRunRecord({
    ...run,
    phase: "confirmed",
    reservationId,
    reservedStepIndex: meta.stepIndex,
    currentStopIndex: 0,
  });
  return reservationId;
}

export function readCourseStepReservationMeta(courseId: string): CourseStepReservationMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const s = sessionStorage.getItem(RESERVE_META(courseId));
    if (!s) return null;
    const o = JSON.parse(s) as CourseStepReservationMeta & { reservationId?: string; stepIndex?: number };
    if (o?.courseId !== courseId) return null;
    const stepIndex = typeof o.stepIndex === "number" && o.stepIndex >= 1 ? o.stepIndex : 1;
    if (!o.reservationId) {
      return { ...o, stepIndex, reservationId: `legacy_${o.completedAt ?? Date.now()}` };
    }
    return { ...o, stepIndex } as CourseStepReservationMeta;
  } catch {
    return null;
  }
}
