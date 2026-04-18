import type { HomeCard } from "@/lib/storeTypes";
import type { PlaceType } from "@/lib/scenarioEngine/types";
import { childFriendlyScore } from "@/lib/recommend/childFriendlyScore";
import type { CourseFeatureTag } from "./courseLearningTypes";

/** catalog CourseTemplateDefinition과 구조 호환 */
export type CourseTemplateShape = {
  indoorPreference: "indoor" | "outdoor" | "mixed";
  movementLevel: "low" | "medium" | "high";
  vibeTags: string[];
};

export function inferCourseFeatureTags(
  def: CourseTemplateShape,
  cards: HomeCard[],
  template: PlaceType[],
  totalTravelMin: number
): CourseFeatureTag[] {
  const tags = new Set<CourseFeatureTag>();

  const indoorLean = def.indoorPreference === "indoor";
  const outdoorWalk = template.includes("WALK") && def.indoorPreference !== "indoor";
  if (indoorLean && !outdoorWalk) tags.add("indoor_heavy");

  if (totalTravelMin <= 32) tags.add("short_distance");

  if (def.movementLevel === "high" || template.includes("ACTIVITY")) tags.add("active");
  if (def.movementLevel === "low" && !template.includes("ACTIVITY")) tags.add("calm");

  const avgChild =
    cards.length > 0
      ? cards.reduce((s, c) => s + childFriendlyScore(c), 0) / cards.length
      : 0;
  if (avgChild >= 0.35) tags.add("family_friendly");

  const vibe = `${def.vibeTags.join(" ")}`.toLowerCase();
  if (/(로맨틱|분위기|감성|야경|데이트|대화)/.test(vibe) || template.some((t) => t === "CULTURE")) {
    tags.add("date_mood");
  }

  return [...tags];
}
