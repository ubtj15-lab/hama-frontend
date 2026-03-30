import type { HomeCard } from "@/lib/storeTypes";
import type { PlaceType } from "./types";

export const DEFAULT_DWELL_MINUTES: Record<PlaceType, number> = {
  FOOD: 80,
  CAFE: 70,
  ACTIVITY: 90,
  WALK: 40,
  CULTURE: 60,
};

/** 같은 권역 / 근거리 / 중거리 이동(분) */
export function estimateTravelMinutes(a: HomeCard, b: HomeCard): number {
  const la = (a as any).lat ?? (a as any).latitude;
  const lo = (a as any).lng ?? (a as any).longitude;
  const lb = (b as any).lat ?? (b as any).latitude;
  const lo2 = (b as any).lng ?? (b as any).longitude;
  if (typeof la !== "number" || typeof lo !== "number" || typeof lb !== "number" || typeof lo2 !== "number") {
    return 15;
  }
  const d = Math.hypot((la - lb) * 111, (lo - lo2) * 88);
  if (d < 0.8) return 10;
  if (d < 2) return 15;
  return 20;
}
