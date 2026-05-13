import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendVertical } from "./normalizeRequest";

export type ScoredCard = { card: HomeCard; score: number };

function norm(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function intentTokens(vertical: RecommendVertical, intent: string | null | undefined): string[] {
  const i = norm(intent ?? "");
  if (!i) return [];
  const out = new Set<string>();
  for (const t of i.split(/[_\s]+/).filter(Boolean)) out.add(t);
  if (vertical === "beauty") {
    for (const t of ["hair", "nail", "lash", "wax", "beauty"]) out.add(t);
  }
  if (vertical === "fitness") {
    for (const t of ["fitness", "gym", "workout", "pt", "yoga"]) out.add(t);
  }
  return [...out];
}

/**
 * 필터 통과 카드만 점수화. 업종 판별은 filter 단계에서 끝난다.
 */
export function scoreCandidatesV2(
  vertical: RecommendVertical,
  query: string,
  intent: string | null | undefined,
  cards: HomeCard[],
  userLat: number | null | undefined,
  userLng: number | null | undefined
): ScoredCard[] {
  const q = norm(query);
  const qTokens = q.split(/\s+/).filter((t) => t.length >= 2);
  const intents = intentTokens(vertical, intent);

  const scored: ScoredCard[] = [];

  for (const card of cards) {
    let score = 1;
    const name = norm(card.name);
    const label = norm(card.categoryLabel ?? "");
    const tags = norm((Array.isArray(card.tags) ? card.tags.join(" ") : "") as string);

    if (q && (name.includes(q) || label.includes(q) || tags.includes(q))) {
      score += 30;
    } else if (qTokens.some((t) => name.includes(t) || label.includes(t) || tags.includes(t))) {
      score += 30;
    }

    if (intents.length) {
      const blob = `${name} ${label} ${tags}`;
      if (intents.some((t) => t.length >= 2 && blob.includes(t))) score += 20;
    }

    const lat = card.lat;
    const lng = card.lng;
    if (
      userLat != null &&
      userLng != null &&
      typeof lat === "number" &&
      typeof lng === "number" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      const km = haversineKm(userLat, userLng, lat, lng);
      const d = Math.max(0, 10 - Math.min(km, 10));
      score += (d / 10) * 10;
    }

    scored.push({ card, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}
