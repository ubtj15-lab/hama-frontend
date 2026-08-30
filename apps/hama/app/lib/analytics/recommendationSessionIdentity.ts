/**
 * Observability-only decision-session identity.
 * Must never be passed into ranking, retrieval, filter, or shuffle.
 */

export function createRecommendationSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * A new raw query starts a new decision session.
 * Shuffle / reject refresh keep the same query string → same session.
 */
export function shouldResetRecommendationSession(
  previousRawQuery: string | null | undefined,
  nextRawQuery: string
): boolean {
  return String(previousRawQuery ?? "") !== String(nextRawQuery ?? "");
}
