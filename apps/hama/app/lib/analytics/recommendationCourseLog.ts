import type { CoursePlan } from "@/lib/scenarioEngine/types";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { logRecommendationEvent } from "./logRecommendationEvent";
import { courseScenarioFieldsFromObject } from "./recommendationContext";
type CourseLogName = "course_impression" | "course_click" | "course_start";

export function logRecommendationCourse(
  event_name: CourseLogName,
  plan: CoursePlan,
  obj: ScenarioObject | null,
  extra: { rank_position?: number; source_page?: string; metadata?: Record<string, unknown> } = {}
): void {
  if (!obj) return;
  const ctx = courseScenarioFieldsFromObject(obj);
  logRecommendationEvent({
    event_name,
    entity_type: "course",
    entity_id: plan.id,
    ...ctx,
    template_id: plan.templateId ?? null,
    step_pattern: plan.template.join(">"),
    place_ids: plan.stops.map((s) => s.placeId),
    rank_position: extra.rank_position ?? null,
    source_page: extra.source_page ?? "results",
    metadata: extra.metadata ?? {},
  });
}
