/**
 * Results V2 presentation helpers. Existing data only. No engine / ranking changes.
 */

import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendationReasonBlock } from "@/lib/recommend/buildRecommendationReason";
import { businessStateFromCard } from "@/lib/recommend/scoreParts";

export const RESULTS_PURPLE = "#6B4DE6";
export const RESULTS_PURPLE_SOFT = "rgba(107, 77, 230, 0.12)";
export const RESULTS_BG = "#FFFDFB";
/** Centered Results content width. Mobile stays 100% with existing page padding. */
export const RESULTS_CONTENT_MAX_WIDTH = 1000;

export const RESULT_HEADER_COPY = "하마가 지금\n잘 맞는 곳을 골라봤어요 ✨";
export const PRIMARY_PICK_LABEL = "하마의 추천";
export const ALTERNATIVE_SECTION_LABEL = "이런 선택도 괜찮을 것 같아요";
export const DECISION_BUTTON_COPY = "여기 갈래요";
export const DECISION_BUTTON_SELECTED_COPY = "선택 완료";
export const REFRESH_BUTTON_COPY = "다른 추천 보기";
export const IMAGE_REFERENCE_LABEL = "장소 참고 이미지";

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] as const;

export function resultsContextLine(now = new Date()): string {
  const hour = now.getHours();
  const part = hour < 12 ? "오전" : hour < 18 ? "오후" : "저녁";
  return `${WEEKDAYS[now.getDay()]} ${part} · 오산`;
}

export function normalizePresentationSentence(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/[.。]+$/g, "")
    .trim();
}

function endSentence(text: string): string {
  const t = normalizePresentationSentence(text);
  if (!t) return "";
  return /[요다음음]$/.test(t) ? `${t}.` : `${t}예요.`;
}

/** Combine existing reason fields. Does not invent claims. */
export function conversationalReasonFromBlock(reason: RecommendationReasonBlock): string {
  const raw = [reason.headline, reason.subline].map(normalizePresentationSentence).filter(Boolean);
  const unique: string[] = [];
  for (const part of raw) {
    const overlap = unique.some((prev) => prev.includes(part) || part.includes(prev));
    if (!overlap) unique.push(part);
  }
  if (unique.length === 0) {
    const badge = normalizePresentationSentence(reason.badges[0] ?? "");
    return badge ? endSentence(badge) : "";
  }
  if (unique.length === 1) return endSentence(unique[0]);
  return `${unique[0]}, ${unique[1]}${/요$/.test(unique[1]) ? "." : "예요."}`;
}

export function oneLineReasonFromBlock(reason: RecommendationReasonBlock): string {
  const first =
    normalizePresentationSentence(reason.headline) ||
    normalizePresentationSentence(reason.subline) ||
    normalizePresentationSentence(reason.badges[0] ?? "");
  if (!first) return "";
  return first.length > 36 ? `${first.slice(0, 36)}…` : first;
}

export function formatDistanceFact(card: HomeCard): string | null {
  const km = card.distanceKm;
  if (typeof km !== "number" || !Number.isFinite(km)) return null;
  return `${km.toFixed(1)}km`;
}

const CATEGORY_FACT: Record<string, string> = {
  restaurant: "식당",
  cafe: "카페",
  salon: "미용",
  activity: "나들이",
  culture: "문화",
};

export function categoryFact(card: HomeCard): string | null {
  const labeled = normalizePresentationSentence(card.categoryLabel ?? "");
  if (labeled) return labeled;
  const key = String(card.category ?? "").toLowerCase();
  return CATEGORY_FACT[key] ?? null;
}

/** Facts already present on the card. Never invents indoor/outdoor/roles. */
export function essentialFacts(card: HomeCard): string[] {
  const out: string[] = [];
  const km = formatDistanceFact(card);
  if (km) out.push(km);
  const cat = categoryFact(card);
  if (cat) out.push(cat);
  if (card.with_kids === true) out.push("아이랑");
  return out.slice(0, 3);
}

export function hoursStatusLabel(card: HomeCard): { label: string; unverified: boolean } {
  const state = businessStateFromCard(card);
  switch (state) {
    case "OPEN":
      return { label: "영업 중", unverified: false };
    case "LAST_ORDER_SOON":
      return { label: "라스트오더 임박", unverified: false };
    case "BREAK":
      return { label: "브레이크타임", unverified: false };
    case "CLOSED":
      return { label: "영업 종료", unverified: false };
    default:
      return { label: "영업 정보 확인 필요", unverified: true };
  }
}

export function hasVerifiedPlacePhoto(_card: HomeCard): boolean {
  return false;
}

/** Visible chip labels only. Exact match after trim. First occurrence wins. */
export function dedupeDisplayChips(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const key = String(raw ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
