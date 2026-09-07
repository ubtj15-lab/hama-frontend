import type { HomeCard } from "@/lib/storeTypes";
import {
  isExplicitHoldemPokerQuery,
  isHoldemPokerCodedVenue,
  toDiscoveryItem,
} from "@/lib/recommend/discoveryRole";
import type { ScenarioObject } from "./types";

export function isCourseHoldemPokerVenue(card: HomeCard): boolean {
  return isHoldemPokerCodedVenue(toDiscoveryItem(card, 0));
}

export function shouldSuppressHoldemForNeutralDateCourse(
  obj: Pick<ScenarioObject, "scenario" | "rawQuery"> | null | undefined
): boolean {
  if (!obj || obj.scenario !== "date") return false;
  return !isExplicitHoldemPokerQuery(obj.rawQuery ?? "");
}

/** Keep ordinary ACTIVITY first; restore holdem only if that would empty the role. */
export function filterNeutralDateActivityCandidates(
  activities: readonly HomeCard[],
  obj: Pick<ScenarioObject, "scenario" | "rawQuery"> | null | undefined
): HomeCard[] {
  if (!shouldSuppressHoldemForNeutralDateCourse(obj) || activities.length === 0) {
    return [...activities];
  }
  const ordinary = activities.filter((card) => !isCourseHoldemPokerVenue(card));
  return ordinary.length > 0 ? ordinary : [...activities];
}
