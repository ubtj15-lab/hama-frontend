import type { HomeCard } from "@/lib/storeTypes";

/** 코스·상세에서 `/reserve`로 넘길 공통 쿼리 (더미 예약 플로우용). */
export function buildReserveQueryFromPlace(opts: {
  storeId: string;
  name: string;
  courseId?: string;
  /** 코스에서만: 예약 context */
  source?: "course" | "place";
  /** 코스 N단계 예약 (현재는 1단계 식당만) */
  stepIndex?: number;
  card?: HomeCard | null;
  /** card 없을 때 코스 정류장 좌표 */
  lat?: number | null;
  lng?: number | null;
}): URLSearchParams {
  const q = new URLSearchParams({
    storeId: opts.storeId,
    name: opts.name,
  });
  const c = opts.card;
  if (c?.naver_place_id) q.set("naverPlaceId", c.naver_place_id);
  if (c?.category) q.set("category", c.category);
  const tel = String(c?.phone ?? "").trim();
  if (tel) q.set("phone", tel.replace(/[^0-9+]/g, ""));
  const lat = typeof opts.lat === "number" ? opts.lat : typeof c?.lat === "number" ? c.lat : null;
  const lng = typeof opts.lng === "number" ? opts.lng : typeof c?.lng === "number" ? c.lng : null;
  if (lat != null) q.set("lat", String(lat));
  if (lng != null) q.set("lng", String(lng));
  if (opts.courseId) {
    q.set("courseId", opts.courseId);
    q.set("source", opts.source ?? "course");
    q.set("stepIndex", String(opts.stepIndex ?? 1));
  }
  return q;
}
