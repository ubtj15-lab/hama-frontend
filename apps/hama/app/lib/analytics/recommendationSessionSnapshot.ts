/**
 * Phase A — durable recommendation-session snapshot (observability only).
 *
 * Direction: ENGINE → snapshot.
 * Never: snapshot → ranking / filter / retrieval / exposure / behavior scoring.
 */

import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import {
  RECOMMENDATION_ENGINE_VERSION,
  type RecommendationEngineVersion,
} from "./recommendationEngineVersion";

export type RecommendationQuSnapshot = {
  route: string | null;
  primary_category: string | null;
  intent_type: string | null;
  intent_category: string | null;
  menu_intent: string[];
  companion: string[];
  purpose: string[];
  discovery_role: string | null;
  negation_detected: boolean;
  excluded_menus: string[];
  excluded_categories: string[];
};

export type RecommendationShownPlaceSnapshot = {
  place_id: string;
  position: number;
  name: string | null;
  category: string | null;
  reason_text: string | null;
  distance_m: number | null;
  travel_time_min: number | null;
};

export type RecommendationSessionSnapshot = {
  engine_version: RecommendationEngineVersion;
  query: string;
  qu_snapshot: RecommendationQuSnapshot;
  shown_places: RecommendationShownPlaceSnapshot[];
};

const ORIGIN_KEYS = new Set(["lat", "lng", "latitude", "longitude", "userLat", "userLng", "origin_lat", "origin_lng"]);

export function distanceKmToMetersForSnapshot(distanceKm: unknown): number | null {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm)) return null;
  return Math.round(distanceKm * 1000);
}

function stringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter((s) => s.length > 0);
}

/**
 * Compact QU fields already present on the frozen parse result.
 * Does not re-run Query Understanding or discovery classification.
 */
export function buildRecommendationQuSnapshot(scenario: ScenarioObject | null | undefined): RecommendationQuSnapshot {
  const uq = scenario?.queryUnderstanding;
  const neg = uq?.negation;
  return {
    route: uq?.route != null ? String(uq.route) : null,
    primary_category: uq?.primaryCategory != null ? String(uq.primaryCategory) : null,
    intent_type: scenario?.intentType != null ? String(scenario.intentType) : null,
    intent_category: scenario?.intentCategory != null ? String(scenario.intentCategory) : null,
    menu_intent: stringList(scenario?.menuIntent?.length ? scenario.menuIntent : uq?.menuIntents),
    companion: stringList(uq?.companionIntents),
    purpose: stringList(uq?.purposeIntents),
    discovery_role: scenario?.conversationalDiscovery?.semanticClass ?? null,
    negation_detected: Boolean(neg?.isNegationQuery),
    excluded_menus: stringList(neg?.excludedMenus),
    excluded_categories: stringList(neg?.excludedCategories),
  };
}

export function buildShownPlaceSnapshots(cards: HomeCard[]): RecommendationShownPlaceSnapshot[] {
  return cards.map((card, index) => ({
    place_id: String(card.id),
    position: index + 1,
    name: typeof card.name === "string" ? card.name : null,
    category: card.category != null ? String(card.category) : null,
    reason_text: typeof card.reasonText === "string" ? card.reasonText : null,
    distance_m: distanceKmToMetersForSnapshot(card.distanceKm),
    travel_time_min: null,
  }));
}

export function buildRecommendationSessionSnapshot(input: {
  query: string;
  scenario: ScenarioObject | null | undefined;
  cards: HomeCard[];
}): RecommendationSessionSnapshot {
  return {
    engine_version: RECOMMENDATION_ENGINE_VERSION,
    query: String(input.query ?? ""),
    qu_snapshot: buildRecommendationQuSnapshot(input.scenario),
    shown_places: buildShownPlaceSnapshots(input.cards),
  };
}

export type RecommendationImpressionHistoryEntry = {
  at: string;
  shown_place_ids: string[];
  shown_places: RecommendationShownPlaceSnapshot[];
};

const MAX_IMPRESSIONS = 20;

export function mergeImpressionHistory(
  previousMetadata: Record<string, unknown> | null | undefined,
  snapshot: RecommendationSessionSnapshot,
  atIso: string
): Record<string, unknown> {
  const prev = previousMetadata && typeof previousMetadata === "object" ? previousMetadata : {};
  const prevImpressions = Array.isArray(prev.impressions) ? prev.impressions : [];
  const nextEntry: RecommendationImpressionHistoryEntry = {
    at: atIso,
    shown_place_ids: snapshot.shown_places.map((p) => p.place_id),
    shown_places: snapshot.shown_places,
  };
  const impressions = [...prevImpressions, nextEntry].slice(-MAX_IMPRESSIONS);
  return {
    ...prev,
    engine_version: snapshot.engine_version,
    query: snapshot.query,
    qu_snapshot: snapshot.qu_snapshot,
    shown_places: snapshot.shown_places,
    session_snapshot: snapshot,
    impressions,
  };
}

/** Recursively true if any origin GPS key is present. Snapshot must stay derived-distance only. */
export function snapshotContainsOriginCoordinates(value: unknown, depth = 0): boolean {
  if (depth > 8 || value == null) return false;
  if (Array.isArray(value)) return value.some((v) => snapshotContainsOriginCoordinates(v, depth + 1));
  if (typeof value !== "object") return false;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (ORIGIN_KEYS.has(k)) return true;
    if (snapshotContainsOriginCoordinates(v, depth + 1)) return true;
  }
  return false;
}
