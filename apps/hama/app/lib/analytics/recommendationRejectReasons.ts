/**
 * Open-beta v1 structured reject reasons.
 * Contextual reports only — never global place attributes or ranking inputs.
 */
export const RECOMMENDATION_REJECT_REASONS = [
  "TOO_FAR",
  "TOO_EXPENSIVE",
  "PARKING_DIFFICULT",
  "SITUATION_MISMATCH",
  "ALREADY_VISITED",
  "NOT_WHAT_I_MEANT",
  "PLACE_INFO_WRONG",
  "OTHER",
] as const;

export type RecommendationRejectReason = (typeof RECOMMENDATION_REJECT_REASONS)[number];

export const RECOMMENDATION_REJECT_REASON_LABELS: Record<RecommendationRejectReason, string> = {
  TOO_FAR: "너무 멀어요",
  TOO_EXPENSIVE: "가격이 안 맞아요",
  PARKING_DIFFICULT: "주차가 불편해요",
  SITUATION_MISMATCH: "지금 상황과 안 맞아요",
  ALREADY_VISITED: "이미 가봤어요",
  NOT_WHAT_I_MEANT: "제가 원한 곳이 아니에요",
  PLACE_INFO_WRONG: "장소 정보가 달라요",
  OTHER: "기타",
};

export function isRecommendationRejectReason(value: unknown): value is RecommendationRejectReason {
  return typeof value === "string" && (RECOMMENDATION_REJECT_REASONS as readonly string[]).includes(value);
}
