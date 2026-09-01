/**
 * Narrow local-recommendation distance eligibility.
 * Does not change ranking weights. Unknown distance is kept (cap needs a reliable km).
 *
 * Named/direct exemption is candidate-specific: compact query must contain that
 * place name. Generic "찾아줘" / "위치" / "어디 있어" never waives the cap globally.
 * Explicit nearby (5 km) is stronger than a named-place exemption.
 */

import type { ScenarioObject } from "@/lib/scenarioEngine/types";

export const EXPLICIT_NEARBY_MAX_KM = 5;
export const DEFAULT_LOCAL_MAX_KM = 15;

const EXPLICIT_NEARBY_RE = /근처|가까운/;
const EXPANDED_DISTANCE_RE = /드라이브|여행|멀어도\s*괜찮|멀리\s*가도/;

export type LocalDistanceCapKind = "none" | "nearby" | "default";

function compactQueryText(value: string): string {
  return String(value ?? "").replace(/\s+/g, "");
}

export function isExpandedDistanceQuery(query: string, parsed?: ScenarioObject | null): boolean {
  const q = String(query ?? parsed?.rawQuery ?? "").trim();
  if (EXPANDED_DISTANCE_RE.test(q)) return true;
  if (parsed?.distanceTolerance === "flexible" && EXPANDED_DISTANCE_RE.test(q)) return true;
  return false;
}

export function isCourseDistanceExempt(parsed?: ScenarioObject | null): boolean {
  return parsed?.intentType === "course_generation" || parsed?.recommendationMode === "course";
}

/** True when the current query identifies this specific place, not a generic lookup. */
export function queryIdentifiesPlaceName(query: string, placeName?: string | null): boolean {
  const name = String(placeName ?? "").trim();
  if (name.length < 2) return false;
  const q = compactQueryText(query);
  const n = compactQueryText(name);
  return n.length >= 2 && q.includes(n);
}

export function resolveLocalDistanceCapKm(query: string, parsed?: ScenarioObject | null): number | null {
  if (isCourseDistanceExempt(parsed)) return null;
  if (isExpandedDistanceQuery(query, parsed)) return null;
  if (parsed?.distanceTolerance === "near_only" || EXPLICIT_NEARBY_RE.test(String(query ?? parsed?.rawQuery ?? ""))) {
    return EXPLICIT_NEARBY_MAX_KM;
  }
  return DEFAULT_LOCAL_MAX_KM;
}

export function localDistanceCapKind(query: string, parsed?: ScenarioObject | null): LocalDistanceCapKind {
  const cap = resolveLocalDistanceCapKm(query, parsed);
  if (cap == null) return "none";
  if (cap === EXPLICIT_NEARBY_MAX_KM) return "nearby";
  return "default";
}

/** True when the candidate must be dropped from ordinary local TOP-N. */
export function exceedsLocalDistanceCap(args: {
  distanceKm: number | null | undefined;
  query: string;
  parsed?: ScenarioObject | null;
  placeName?: string | null;
}): boolean {
  const cap = resolveLocalDistanceCapKm(args.query, args.parsed);
  const km = args.distanceKm;

  if (cap === EXPLICIT_NEARBY_MAX_KM) {
    if (typeof km !== "number" || !Number.isFinite(km)) return false;
    return km > cap;
  }

  if (queryIdentifiesPlaceName(args.query, args.placeName)) return false;

  if (cap == null) return false;
  if (typeof km !== "number" || !Number.isFinite(km)) return false;
  return km > cap;
}

export function applyLocalDistanceSafety<T>(
  pool: T[],
  args: {
    query: string;
    parsed?: ScenarioObject | null;
    distanceKmOf: (item: T) => number | null | undefined;
    placeNameOf?: (item: T) => string | null | undefined;
  }
): T[] {
  return pool.filter(
    (item) =>
      !exceedsLocalDistanceCap({
        distanceKm: args.distanceKmOf(item),
        query: args.query,
        parsed: args.parsed,
        placeName: args.placeNameOf?.(item),
      })
  );
}
