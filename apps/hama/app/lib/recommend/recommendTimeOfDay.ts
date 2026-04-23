import type { TimeOfDay } from "./courseTypes";

export type TimeBucket = "day" | "evening" | "night";

/** 현재 시각 + intent timeOfDay 로 저녁/밤/주간 느낌만 구분 (예약과 무관) */
export function resolveTimeOfDayBucket(now: Date, timeOfDay: TimeOfDay): TimeBucket {
  const h = now.getHours();
  if (timeOfDay === "night" || h >= 22 || h < 5) return "night";
  if (timeOfDay === "dinner" || (h >= 17 && h < 22)) return "evening";
  return "day";
}
