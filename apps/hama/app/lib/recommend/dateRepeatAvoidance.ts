/**
 * Session/context-local DATE repeat avoidance.
 * Does not change ranking weights. Empty avoid-ids → original discovery deck.
 */

import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import type { DiscoveryClassification } from "./discoveryRole";

const DATE_QUERY_RE = /데이트|연인|커플/;

export function repeatAvoidanceContextKey(
  query: string,
  scenario?: string | null
): string {
  const q = String(query ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 80);
  const sc = String(scenario ?? "")
    .trim()
    .toLowerCase();
  return `${q}|${sc}`;
}

export function isDateRepeatAvoidanceContext(
  query: string,
  parsed: ScenarioObject | null | undefined
): boolean {
  if (!parsed) return false;
  if (parsed.recommendationMode === "course" || parsed.intentType === "course_generation") {
    return false;
  }
  if (parsed.scenario === "date") return true;
  return DATE_QUERY_RE.test(String(query ?? parsed.rawQuery ?? ""));
}

export function shouldApplyDateRepeatAvoidance(
  query: string,
  parsed: ScenarioObject,
  classification: Pick<DiscoveryClassification, "isDiscovery" | "role">
): boolean {
  if (!isDateRepeatAvoidanceContext(query, parsed)) return false;
  return classification.isDiscovery === true && classification.role === "DATE";
}

/**
 * Two-pass deck pick from an already-ordered viable pool.
 * Pass 1: unseen. Pass 2: fill from previously shown in the same order.
 */
export function applyRepeatAvoidanceToOrderedDeck<T extends { id: string }>(
  ordered: readonly T[],
  avoidIds: readonly string[],
  deckSize: number
): T[] {
  const cap = Math.max(0, Math.floor(deckSize));
  if (cap <= 0) return [];
  const avoid = new Set(avoidIds.map((id) => String(id ?? "").trim()).filter(Boolean));
  if (avoid.size === 0) return ordered.slice(0, cap);

  const unseen: T[] = [];
  const seen: T[] = [];
  const used = new Set<string>();
  for (const item of ordered) {
    const id = String(item?.id ?? "").trim();
    if (!id || used.has(id)) continue;
    used.add(id);
    if (avoid.has(id)) seen.push(item);
    else unseen.push(item);
  }
  return [...unseen, ...seen].slice(0, Math.min(cap, unseen.length + seen.length));
}
