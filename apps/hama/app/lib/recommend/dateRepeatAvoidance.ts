/**
 * Session/context-local repeat avoidance for Home discovery situations.
 * DATE keeps its original DATE-only gate. Home Situation Repeat V1 reuses the
 * same two-pass reorder for FOOD / INDOOR PLAY / RELAX.
 * Does not change ranking weights. Empty avoid-ids → original deck.
 */

import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import {
  classifyDiscoveryQuery,
  isIndoorPlaySeekingQuery,
  type DiscoveryClassification,
} from "./discoveryRole";

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
 * Generic Home FOOD situation ("뭐 먹지" family). Named dishes, catalog menus,
 * DATE/INDOOR/RELAX queries, and course stay out.
 */
export function isHomeFoodSituationQuery(
  query: string,
  parsed: ScenarioObject | null | undefined
): boolean {
  if (!parsed) return false;
  if (parsed.recommendationMode === "course" || parsed.intentType === "course_generation") {
    return false;
  }
  if (parsed.catalogMenu?.catalogMenuPrimary) return false;
  const raw = String(query ?? parsed.rawQuery ?? "").trim();
  if (!raw) return false;
  if (/데이트|연인|커플/.test(raw)) return false;
  if (/실내/.test(raw) && /놀/.test(raw)) return false;
  return /뭐\s*먹지|맛있는\s*거\s*먹/.test(raw);
}

/**
 * Home discovery situations that reuse DATE's TOP3 soft-avoid:
 * DATE, generic FOOD, INDOOR PLAY, RELAX.
 */
export function shouldApplyHomeSituationRepeatAvoidance(
  query: string,
  parsed: ScenarioObject | null | undefined,
  classification?: Pick<DiscoveryClassification, "isDiscovery" | "role">
): boolean {
  if (!parsed) return false;
  if (parsed.recommendationMode === "course" || parsed.intentType === "course_generation") {
    return false;
  }
  const cls = classification ?? classifyDiscoveryQuery(query, parsed);
  if (shouldApplyDateRepeatAvoidance(query, parsed, cls)) return true;
  if (isIndoorPlaySeekingQuery(query, parsed)) return true;
  if (cls.role === "RELAX" && cls.isDiscovery) return true;
  if (isHomeFoodSituationQuery(query, parsed)) return true;
  return false;
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
