import type { IntentCategory, ScenarioObject } from "@/lib/scenarioEngine/types";
import type { HomeCard } from "@/lib/storeTypes";
import { isNearbyShownMeal } from "./followUp";

export type LinkedPurpose = {
  intentCategory: "FOOD";
  /**
   * A later food group should reuse this scenario's region and the first
   * kept place's coordinates. The current result page ranks one pool, so
   * this group is stored separately instead of replacing the play list.
   */
  link: "region_and_anchor_place";
};

function norm(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "밥 먹을 곳도" adds a purpose. It does not by itself replace the current one. */
export function detectLinkedFoodPurpose(text: string): boolean {
  const q = norm(text);
  if (isNearbyShownMeal(q)) return true;
  if (!/도/.test(q)) return false;
  return /밥\s*먹|식사|먹을\s*곳|맛집|식당/.test(q);
}

export function nextLinkedPurposes(
  previous: readonly LinkedPurpose[] | undefined,
  text: string,
  refinement: string
): LinkedPurpose[] | undefined {
  if (refinement === "new_request" && !detectLinkedFoodPurpose(text)) return undefined;
  const kept = refinement === "new_request" ? [] : [...(previous ?? [])];
  if (detectLinkedFoodPurpose(text) && !kept.some((item) => item.intentCategory === "FOOD")) {
    kept.push({ intentCategory: "FOOD", link: "region_and_anchor_place" });
  }
  return kept.length ? kept : undefined;
}

/** Food ranking input for a second group. Does not mutate or re-score the play scenario. */
export function buildLinkedFoodScenario(primary: ScenarioObject, nearRequested = false): ScenarioObject {
  return {
    ...primary,
    intentCategory: "FOOD" as IntentCategory,
    intentType: "search_strict",
    mealRequired: true,
    indoorPreferred: false,
    recommendationMode: "single",
    conversationExcludePlaceIds: undefined,
    distanceTolerance: nearRequested ? "near_only" : primary.distanceTolerance,
  };
}

/** Saved play cards are usable only when every entry has a unique id and a name. */
export function validShownPlayCards(
  cards: readonly Pick<HomeCard, "id" | "name">[] | null | undefined
): cards is HomeCard[] {
  if (!cards?.length) return false;
  const seen = new Set<string>();
  return cards.every((card) => {
    const id = String(card?.id ?? "").trim();
    const name = String(card?.name ?? "").trim();
    if (!id || !name || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function playListStabilityKey(
  scenario: Pick<ScenarioObject, "intentCategory" | "region" | "indoorPreferred" | "withKids" | "intentType"> | null | undefined
): string {
  if (!scenario) return "";
  return [
    scenario.intentCategory ?? "",
    scenario.region ?? "",
    scenario.indoorPreferred ? "1" : "0",
    scenario.withKids ? "1" : "0",
    scenario.intentType ?? "",
  ].join("|");
}

/** A meal add-on must not replace play cards when region, indoor, kids, and category stay the same. */
export function shouldKeepShownPlayList(addsFood: boolean, previousKey: string, nextKey: string): boolean {
  return addsFood && previousKey !== "" && previousKey === nextKey;
}

export function resolveFoodAnchor<T extends { id: string; lat?: number | null; lng?: number | null }>(
  playCards: readonly T[],
  selectedId: string | null
): { card: T | null; provisional: boolean } {
  const hasCoords = (card: T) => typeof card.lat === "number" && typeof card.lng === "number";
  const selected = selectedId ? playCards.find((card) => card.id === selectedId && hasCoords(card)) : undefined;
  if (selected) return { card: selected, provisional: false };
  const first = playCards.find(hasCoords) ?? null;
  return { card: first, provisional: first != null };
}
