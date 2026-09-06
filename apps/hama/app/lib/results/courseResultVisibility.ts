/**
 * Results-layer visibility for course vs ordinary recommendation list.
 * Does not change ranking, course generation, or repeat memory.
 */
export function resolveOrdinaryRecommendationListVisible(input: {
  showCourseDeck: boolean;
  baseShowRecommendationList: boolean;
  forceSituationRecommendationListVisible: boolean;
  forceShowListByCards: boolean;
}): boolean {
  if (input.showCourseDeck) return false;
  return (
    input.baseShowRecommendationList ||
    input.forceSituationRecommendationListVisible ||
    input.forceShowListByCards
  );
}
