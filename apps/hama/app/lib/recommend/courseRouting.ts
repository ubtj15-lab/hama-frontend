import type { PlaceCandidate, RouteLeg, RouteMetrics } from "./courseTypes";

const EARTH_KM = 6371;

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** 두 좌표 간 km — 좌표 없으면 null */
export function haversineKm(a: Pick<PlaceCandidate, "lat" | "lng">, b: Pick<PlaceCandidate, "lat" | "lng">): number | null {
  const la = a.lat;
  const ln = a.lng;
  const lb = b.lat;
  const lnb = b.lng;
  if (la == null || ln == null || lb == null || lnb == null) return null;
  const dLat = toRad(lb - la);
  const dLon = toRad(lnb - ln);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(la)) * Math.cos(toRad(lb)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return EARTH_KM * c;
}

/** 도시 구간 평균 — TODO: OSRM / Directions API로 교체 */
export function estimateTravelMinutesFromKm(distanceKm: number | null, mode: "walk" | "drive" = "drive"): number {
  if (distanceKm == null || distanceKm <= 0) return 0;
  const kmh = mode === "walk" ? 4.5 : 22;
  return Math.round((distanceKm / kmh) * 60);
}

export function estimateTravelMinutes(a: PlaceCandidate, b: PlaceCandidate, mode: "walk" | "drive" = "drive"): number {
  return estimateTravelMinutesFromKm(haversineKm(a, b), mode);
}

/**
 * 경로 합산 거리·다리·직선비율·왕복 페널티.
 * TODO: 생활권 클러스터 가점은 외부 지역 테이블과 결합.
 */
export function computeRouteMetrics(places: PlaceCandidate[]): RouteMetrics {
  if (places.length === 0) {
    return {
      pathKm: 0,
      legs: [],
      travelMinutesTotal: 0,
      directKm: null,
      efficiencyRatio: 1,
      backtrackPenalty: 0,
    };
  }
  const legs: RouteLeg[] = [];
  let pathKm = 0;
  let travelMinutesTotal = 0;
  const mode: "walk" | "drive" = places.length > 2 ? "drive" : "drive";
  for (let i = 0; i < places.length - 1; i++) {
    const km = haversineKm(places[i]!, places[i + 1]!);
    const d = km ?? 0;
    pathKm += d;
    const tm = estimateTravelMinutesFromKm(km, mode);
    travelMinutesTotal += tm;
    legs.push({ fromIndex: i, toIndex: i + 1, distanceKm: d, travelMinutes: tm });
  }
  const directKm = places.length >= 2 ? haversineKm(places[0]!, places[places.length - 1]!) : null;
  let efficiencyRatio = 1;
  if (directKm != null && pathKm > 1e-6) {
    efficiencyRatio = Math.min(1, directKm / pathKm);
  }
  /** 직선 대비 경로가 길수록(왕복 의심) 페널티 */
  const backtrackPenalty = Math.max(0, Math.min(100, (1 - efficiencyRatio) * 100));

  return {
    pathKm,
    legs,
    travelMinutesTotal,
    directKm,
    efficiencyRatio,
    backtrackPenalty,
  };
}

/** UI용 총 소요 문구 */
export function formatHumanReadableDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `총 약 ${m}분`;
  if (m === 0) return `총 약 ${h}시간`;
  return `총 약 ${h}시간 ${m}분`;
}
