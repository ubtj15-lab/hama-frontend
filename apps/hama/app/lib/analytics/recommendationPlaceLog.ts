import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { logRecommendationEvent } from "./logRecommendationEvent";
import { courseScenarioFieldsFromObject } from "./recommendationContext";

export function logRecommendationPlace(
  event_name: "place_impression" | "place_click",
  card: HomeCard,
  obj: ScenarioObject | null,
  extra: { recommendation_rank?: number; rank_position?: number; source_page?: string; metadata?: Record<string, unknown> } = {}
): void {
  if (!obj) return;
  const ctx = courseScenarioFieldsFromObject(obj);
  logRecommendationEvent({
    event_name,
    entity_type: "place",
    entity_id: card.id,
    ...ctx,
    place_ids: [card.id],
    recommendation_rank: extra.recommendation_rank ?? extra.rank_position ?? null,
    source_page: extra.source_page ?? "results",
    place_snapshot: {
      id: card.id,
      name: card.name,
      category: (card as any).category ?? null,
      phone: (card as any).phone ?? null,
    },
    metadata: { name: card.name, ...extra.metadata },
  });
}
