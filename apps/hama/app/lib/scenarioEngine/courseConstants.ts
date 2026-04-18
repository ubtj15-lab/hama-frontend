import type { HomeCard } from "@/lib/storeTypes";
import type { PlaceType } from "./types";

/** 업종별 기본 체류(분) — 중앙값; 실제는 가중 랜덤 범위 내에서 선택 */
export const DEFAULT_DWELL_MINUTES: Record<PlaceType, number> = {
  FOOD: 80,
  CAFE: 55,
  ACTIVITY: 90,
  WALK: 45,
  CULTURE: 65,
};

/** 체류 시간 범위(분) — 총 소요 시간 현실화 */
export const DWELL_RANGE_MINUTES: Record<PlaceType, { min: number; max: number }> = {
  FOOD: { min: 70, max: 90 },
  CAFE: { min: 40, max: 70 },
  ACTIVITY: { min: 60, max: 120 },
  WALK: { min: 30, max: 60 },
  CULTURE: { min: 50, max: 90 },
};

function cardLatLng(p: HomeCard): { lat: number; lng: number } | null {
  const la = (p as any).lat ?? (p as any).latitude;
  const lo = (p as any).lng ?? (p as any).longitude;
  if (typeof la !== "number" || typeof lo !== "number" || !Number.isFinite(la) || !Number.isFinite(lo)) {
    return null;
  }
  return { lat: la, lng: lo };
}

/** 두 카드 간 대략 거리(km). 좌표 없으면 null */
export function haversineKm(a: HomeCard, b: HomeCard): number | null {
  const A = cardLatLng(a);
  const B = cardLatLng(b);
  if (!A || !B) return null;
  const R = 6371;
  const dLat = ((B.lat - A.lat) * Math.PI) / 180;
  const dLng = ((B.lng - A.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((A.lat * Math.PI) / 180) * Math.cos((B.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

/**
 * 거리(km) → 이동 시간(분). 도보·대중교통 혼합 가정.
 * (기존 estimateTravelMinutes와 호환되도록 스케일 유사)
 */
export function estimateTravelMinutesFromKm(km: number | null): number {
  if (km == null || !Number.isFinite(km)) return 18;
  if (km < 0.5) return 8;
  if (km < 1.2) return 12;
  if (km < 2.5) return 16;
  if (km < 4) return 22;
  if (km < 6) return 28;
  return Math.min(45, Math.round(12 + km * 3.2));
}

/** 같은 권역 / 근거리 / 중거리 이동(분) — 좌표 있으면 km 기반 */
export function estimateTravelMinutes(a: HomeCard, b: HomeCard): number {
  const km = haversineKm(a, b);
  return estimateTravelMinutesFromKm(km);
}

/** 시드 기반 체류 시간 — 동일 입력에 안정적인 값 */
export function dwellMinutesForPlace(place: HomeCard, stepType: PlaceType, seed: string): number {
  const range = DWELL_RANGE_MINUTES[stepType] ?? { min: 50, max: 80 };
  let h = 0;
  const key = `${seed}|${place.id}|${stepType}`;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const t = (h % 1000) / 1000;
  return Math.round(range.min + t * (range.max - range.min));
}
