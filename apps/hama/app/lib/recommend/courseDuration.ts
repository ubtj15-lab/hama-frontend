import type { CourseStop } from "@/lib/scenarioEngine/types";
import { formatHumanReadableDuration } from "./courseRouting";

/** @deprecated 시나리오 엔진 `CourseStop` 합산용 — 신규는 `GeneratedCourse.totalDurationMin` */
export { formatHumanReadableDuration as formatHumanDuration };

export function totalDurationFromStops(stops: CourseStop[]): number {
  return stops.reduce((s, x) => s + x.dwellMinutes + (x.travelMinutesToNext ?? 0), 0);
}

export function humanReadableCourseDuration(stops: CourseStop[]): string {
  return formatHumanReadableDuration(totalDurationFromStops(stops));
}
