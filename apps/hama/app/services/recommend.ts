import { calculateScore, type ScoreContext, type ScorePlace } from "@/utils/calculateScore";

type ScoredPlace<T extends ScorePlace> = T & {
  score: number;
  detail: ReturnType<typeof calculateScore>["detail"];
};

export function recommendPlaces<T extends ScorePlace>(places: T[], context: ScoreContext): ScoredPlace<T>[] {
  const scored = places.map((place) => {
    const score = calculateScore(place, context);

    return {
      ...place,
      score: score.total,
      detail: score.detail,
    };
  });

  const sorted = scored.sort((a, b) => b.score - a.score);

  // 핵심 로그 (개발 중 검증용)
  console.log("=== 추천 로그 ===");
  console.log("유저 상황:", context);
  console.log("후보 개수:", places.length);

  console.table(
    sorted.slice(0, 10).map((p) => ({
      name: String((p as { name?: unknown }).name ?? ""),
      total: p.score,
      scenarioFit: p.detail.scenarioFit,
      distance: p.detail.distance,
      categoryMatch: p.detail.categoryMatch,
      timeCtx: p.detail.timeContext,
      capability: p.detail.capability,
      penalty: p.detail.penalty,
    }))
  );

  return sorted.slice(0, 3);
}
