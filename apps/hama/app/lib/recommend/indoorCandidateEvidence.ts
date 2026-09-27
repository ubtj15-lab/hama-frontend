import type { HomeCard } from "@/lib/storeTypes";
import {
  hasCredibleIndoorPlayEvidence,
  isParkOrWalkPlace,
  toDiscoveryItem,
} from "@/lib/recommend/discoveryRole";

export type IndoorEvidence = "outdoor" | "indoor" | "estimated" | "unknown";

function withoutRoadNames(text: string): string {
  return text.replace(/공원대로|공원로|공원길/g, "");
}

/**
 * Road names such as 동탄공원로 are not an outdoor facility.
 * A floor or basement is only an estimate, not verified indoor business data.
 */
export function indoorEvidenceFor(card: HomeCard): IndoorEvidence {
  const item = toDiscoveryItem(card, 0);
  const name = String(card.name ?? "");
  const address = String(card.address ?? "");
  const facilityText = withoutRoadNames(`${name} ${address}`);
  if (isParkOrWalkPlace(item) || /물놀이장|물놀이|산책로|공원/.test(facilityText)) return "outdoor";
  if (hasCredibleIndoorPlayEvidence(item) || /키즈카페|실내놀이|실내|보드게임/.test(name)) return "indoor";
  if (/지하|\d+층/.test(`${name} ${address}`)) return "estimated";
  return "unknown";
}

export function keepForIndoorRequest<T extends HomeCard>(cards: readonly T[]): T[] {
  return cards.filter((card) => indoorEvidenceFor(card) === "indoor");
}
