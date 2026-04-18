/**
 * 코스 복원·동선 분석 — logEvent type 을 이벤트명과 동일하게 두어 `/api/log` → Supabase 적재 시 매핑 단순화.
 * (course_debug 와 별도로 상위 이벤트명으로 한 번 더 보냄)
 */
import { logEvent } from "@/lib/logEvent";

export function logCourseRestoreSuccess(payload: {
  courseId: string;
  placeIds: string[];
  restoreSource?: string | null;
}): void {
  logEvent("course_restore_success", {
    course_id: payload.courseId,
    place_ids: payload.placeIds,
    restore_source: payload.restoreSource ?? undefined,
  });
}

export function logCourseRestoreFail(payload: { courseId: string }): void {
  logEvent("course_restore_fail", { course_id: payload.courseId });
}

export function logCourseRandomFallbackBlocked(payload: {
  courseId: string;
  restoreSource?: string | null;
}): void {
  logEvent("course_random_fallback_blocked", {
    course_id: payload.courseId,
    restore_source: payload.restoreSource ?? undefined,
  });
}

export function logCourseRouteEnter(payload: {
  courseId: string;
  hasQuerySnap: boolean;
  hasHashSnap: boolean;
}): void {
  logEvent("course_route_enter", {
    course_id: payload.courseId,
    has_query_snap: payload.hasQuerySnap,
    has_hash_snap: payload.hasHashSnap,
  });
}

export function logCourseStartClick(payload: {
  courseId: string;
  placeIds: string[];
}): void {
  logEvent("course_start_click", {
    course_id: payload.courseId,
    place_ids: payload.placeIds,
  });
}
