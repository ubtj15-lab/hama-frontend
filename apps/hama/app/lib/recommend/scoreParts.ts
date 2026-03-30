import type { HomeCard } from "@/lib/storeTypes";
import { DISTANCE_SCORE_WHEN_UNKNOWN } from "./recommendConstants";

export type BusinessState = "OPEN" | "LAST_ORDER_SOON" | "BREAK" | "UNKNOWN" | "CLOSED";

export function distanceScoreFromKm(km: number | null): number {
  if (km == null || !Number.isFinite(km)) return DISTANCE_SCORE_WHEN_UNKNOWN;
  if (km <= 0.5) return 100;
  if (km <= 1) return 90;
  if (km <= 2) return 75;
  if (km <= 3) return 60;
  if (km <= 5) return 40;
  return 15;
}

export function businessScoreFromState(state: BusinessState): number {
  switch (state) {
    case "OPEN":
      return 100;
    case "LAST_ORDER_SOON":
      return 70;
    case "BREAK":
      return 20;
    case "UNKNOWN":
      return 45;
    case "CLOSED":
      return 0;
    default:
      return 45;
  }
}

/** 카드 필드 → 비즈니스 상태 (TODO: Supabase opening_hours 스냅샷 연동) */
export function businessStateFromCard(card: HomeCard): BusinessState {
  const c = card as any;
  const v = c.business_state ?? c.opening_hint ?? c.opening_status ?? c.open_now_status;
  if (v === "CLOSED" || v === "closed" || v === "휴무") return "CLOSED";
  if (v === "OPEN" || v === "open" || v === true) return "OPEN";
  if (v === "LAST_ORDER_SOON" || v === "closing_soon" || v === "closingSoon" || v === "마감임박")
    return "LAST_ORDER_SOON";
  if (v === "BREAK" || v === "break" || v === "브레이크") return "BREAK";
  if (v === "UNKNOWN" || v === "unknown") return "UNKNOWN";
  return "UNKNOWN";
}

function normCompact(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function normSpace(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 품질 0~100. rating 없으면 중간대(50).
 * TODO(Supabase): rating, review_count 동기화
 */
export function qualityScoreFromCard(card: HomeCard): number {
  const c = card as any;
  const rating =
    typeof c.rating === "number" ? c.rating : typeof c.rating_avg === "number" ? c.rating_avg : null;

  let base: number;
  if (rating == null || Number.isNaN(rating)) base = 50;
  else if (rating >= 4.8) base = 100;
  else if (rating >= 4.5) base = 85;
  else if (rating >= 4.2) base = 70;
  else if (rating >= 4.0) base = 55;
  else if (rating >= 3.8) base = 40;
  else base = 20;

  const reviewCount =
    typeof c.review_count === "number"
      ? c.review_count
      : typeof c.reviews_count === "number"
        ? c.reviews_count
        : null;
  if (reviewCount == null) return Math.min(100, base);
  let mult = 1;
  if (reviewCount < 5) mult = 0.6;
  else if (reviewCount < 20) mult = 0.8;
  else if (reviewCount < 50) mult = 0.9;
  return Math.min(100, Math.round(base * mult));
}

function inferQueryCategoryHint(q: string): string | null {
  const t = normSpace(q);
  if (/(카페|커피|디저트)/.test(t)) return "cafe";
  if (/(식당|맛집|밥|레스토랑|한식|일식|중식|양식)/.test(t)) return "restaurant";
  if (/(미용|헤어|살롱)/.test(t)) return "salon";
  if (/(액티|체험|공원)/.test(t)) return "activity";
  return null;
}

/**
 * 검색어 보조 점수 0~100. query 없으면 0.
 */
export function keywordScoreFromQuery(query: string | null | undefined, card: HomeCard, blob: string): number {
  const raw = String(query ?? "").trim();
  if (!raw) return 0;

  let s = 0;
  const qC = normCompact(raw);
  const nameC = normCompact(card.name ?? "");
  if (qC.length >= 2) {
    if (nameC === qC) s += 100;
    else if (nameC.includes(qC) || qC.includes(nameC)) s += 60;
  }

  const cat = String(card.category ?? "").toLowerCase();
  const hint = inferQueryCategoryHint(raw);
  if (hint && cat === hint) s += 25;

  const desc = normSpace(String((card as any).description ?? ""));
  if (desc.length > 0) {
    const tokens = normSpace(raw)
      .split(/\s+/)
      .map(normCompact)
      .filter((t) => t.length >= 2);
    for (const tok of tokens) {
      if (normCompact(desc).includes(tok)) {
        s += 15;
        break;
      }
    }
  }

  const tags = Array.isArray((card as any).tags) ? (card as any).tags.map((x: any) => normCompact(String(x))) : [];
  let tagHits = 0;
  const qToks = normSpace(raw)
    .split(/\s+/)
    .map(normCompact)
    .filter((t) => t.length >= 2);
  const blobC = normCompact(blob);
  for (const tok of qToks) {
    if (!tok) continue;
    if (tags.some((t: string) => t.includes(tok) || tok.includes(t))) tagHits++;
    else if (blobC.includes(tok)) tagHits++;
  }
  if (tagHits >= 1) s += 15;
  if (tagHits >= 3) s += 10;

  return Math.min(100, s);
}

/** 보너스 0~100. recently_popular 는 DB 확장용. */
export function bonusScoreFromCard(card: HomeCard, blob: string): number {
  const c = card as any;
  let b = 0;
  const img =
    (typeof c.image_url === "string" && c.image_url.trim()) ||
    (typeof c.imageUrl === "string" && c.imageUrl.trim());
  if (img) b += 25;
  if (typeof c.phone === "string" && c.phone.replace(/\D/g, "").length >= 8) b += 15;
  if (typeof c.description === "string" && c.description.trim().length > 15) b += 15;
  if (c.reservation_required === true || /예약/.test(blob)) b += 20;
  if (/주차|무료주차|발렛/.test(blob)) b += 15;
  if (c.recently_popular === true || c.is_hot === true) b += 10;
  return Math.min(100, b);
}
