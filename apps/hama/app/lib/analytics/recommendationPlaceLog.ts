import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { logRecommendationEvent } from "./logRecommendationEvent";
import { courseScenarioFieldsFromObject } from "./recommendationContext";

export function logRecommendationPlace(
  event_name: "place_impression" | "place_click",
  card: HomeCard,
  obj: ScenarioObject | null,
  extra: { rank_position?: number; source_page?: string; metadata?: Record<string, unknown> } = {}
): void {
  if (!obj) return;
  const ctx = courseScenarioFieldsFromObject(obj);
  logRecommendationEvent({
    event_name,
    entity_type: "place",
    entity_id: card.id,
    ...ctx,
    place_ids: [card.id],
    rank_position: extra.rank_position ?? null,
    source_page: extra.source_page ?? "results",
    metadata: { name: card.name, ...extra.metadata },
  });
}
