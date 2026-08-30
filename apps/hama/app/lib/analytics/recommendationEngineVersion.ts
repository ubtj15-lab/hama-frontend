/**
 * Runtime recommendation-engine version for observability.
 * Not a Challenge fingerprint. Not an input to ranking.
 */
export const RECOMMENDATION_ENGINE_VERSION = "recommendation-v1" as const;

export type RecommendationEngineVersion = typeof RECOMMENDATION_ENGINE_VERSION;
