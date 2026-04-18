import { logEvent } from "@/lib/logEvent";

export type CourseDebugPayload = {
  event:
    | "course_generate"
    | "course_click_start"
    | "course_route_enter"
    | "course_restore_success"
    | "course_restore_fail"
    | "course_random_fallback_blocked";
  courseId?: string;
  stepIds?: string[];
  source?: "session" | "local" | "query_snap" | "hash_snap" | "state" | "restored" | null;
  fallbackBlocked?: boolean;
  userAgent?: string;
  extra?: Record<string, unknown>;
};

function ua(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent ?? "";
}

export function logCourseDebug(p: CourseDebugPayload): void {
  try {
    logEvent("course_debug", {
      course_debug_event: p.event,
      course_id: p.courseId,
      step_ids: p.stepIds,
      restore_source: p.source,
      fallback_blocked: p.fallbackBlocked,
      user_agent: ua(),
      ...p.extra,
    });
  } catch {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
      console.log("[course_debug]", p);
    }
  }
}
