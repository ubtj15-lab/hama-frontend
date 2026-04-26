import {
  HYBRID_WEIGHT_BEHAVIOR,
  HYBRID_WEIGHT_CONVENIENCE,
  HYBRID_WEIGHT_DISTANCE,
  HYBRID_WEIGHT_PERSONAL,
  HYBRID_WEIGHT_RATING,
  HYBRID_WEIGHT_SCENARIO,
} from "./recommendConstants";

export type HybridScoreParts = {
  distanceScore: number;
  ratingScore: number;
  scenarioRichScore: number;
  convenienceScore: number;
  /** 0~100, neutral 50 @see normalizeBehaviorRawToScore */
  behaviorPillar: number;
  /** @see behaviorBoostVisibilityFactor */
  behaviorVisibility: number;
  personalizationScore: number;
};

/**
 * 룰·거리·평점·편의·행동(가시성 감쇠)·개인화 블렌드 최종 점수.
 * `buildTopRecommendations` 와 동일한 가중 구조.
 */
export function computeHybridRecommendationFinal(parts: HybridScoreParts): number {
  const behaviorPoints =
    parts.behaviorVisibility <= 0 ? 0 : parts.behaviorPillar * HYBRID_WEIGHT_BEHAVIOR * parts.behaviorVisibility;
  return (
    parts.distanceScore * HYBRID_WEIGHT_DISTANCE +
    parts.ratingScore * HYBRID_WEIGHT_RATING +
    parts.scenarioRichScore * HYBRID_WEIGHT_SCENARIO +
    parts.convenienceScore * HYBRID_WEIGHT_CONVENIENCE +
    behaviorPoints +
    parts.personalizationScore * HYBRID_WEIGHT_PERSONAL
  );
}
