import type { CoursePatternStats } from "./courseLearningTypes";
import { MIN_IMPRESSIONS_FULL_WEIGHT } from "./courseLearningConstants";
import type { CourseLearningStore } from "./courseLearningStore";

/** impressions 대비 출발률이 높은 패턴 (운영 대시보드·A/B용) */
export function extractTopPatternsByStartRate(
  store: CourseLearningStore,
  minImpressions = MIN_IMPRESSIONS_FULL_WEIGHT
): { key: string; startRate: number; stats: CoursePatternStats }[] {
  const out: { key: string; startRate: number; stats: CoursePatternStats }[] = [];
  for (const stats of store.patternStats.values()) {
    if (stats.impressions < minImpressions) continue;
    const startRate = stats.starts / stats.impressions;
    out.push({ key: stats.key, startRate, stats });
  }
  return out.sort((a, b) => b.startRate - a.startRate);
}
