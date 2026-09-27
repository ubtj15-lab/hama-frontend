/**
 * Venue polarity reconciliation.
 * A canonical venue cannot be both POSITIVE_REQUIRED and HARD_EXCLUDED.
 * Uses existing venue ids (kids_cafe, alcohol) — does not add taxonomy.
 */
import type { ParsedRecommendationQuery } from "./types";

export type VenuePolarityDebug = {
  positiveBefore: string[];
  excludedVenues: string[];
  positiveAfter: string[];
  removedByExclusion: string[];
  contradictionResolved: boolean;
};

export type VenueSurface = {
  phrases: readonly string[];
  purposes: readonly string[];
  menus: readonly string[];
};

/** Canonical venue surfaces already used by negation / QU. */
export const VENUE_SURFACES: Record<string, VenueSurface> = {
  kids_cafe: {
    phrases: ["키즈카페", "키즈 카페", "놀이카페", "키즈룸"],
    purposes: ["kids_cafe"],
    menus: ["키즈카페"],
  },
  alcohol: {
    phrases: ["술집", "포차", "이자카야", "호프"],
    purposes: [],
    menus: [],
  },
};

export function normalizeVenueId(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function uniq(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const id = normalizeVenueId(x);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function compact(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function textHasPhrase(spaced: string, packed: string, phrase: string): boolean {
  const p = String(phrase ?? "")
    .toLowerCase()
    .trim();
  if (p.length < 2) return false;
  if (spaced.includes(p)) return true;
  const pc = compact(p);
  return pc.length >= 2 && packed.includes(pc);
}

export function venueIdFromPurpose(purpose: string): string | null {
  const p = String(purpose ?? "").trim();
  for (const [id, spec] of Object.entries(VENUE_SURFACES)) {
    if (spec.purposes.includes(p)) return id;
  }
  return null;
}

export function venueIdFromMenu(menu: string): string | null {
  const m = String(menu ?? "").trim();
  for (const [id, spec] of Object.entries(VENUE_SURFACES)) {
    if (spec.menus.includes(m)) return id;
  }
  return null;
}

export function collectPositiveVenuesFromQuery(rawQuery: string): string[] {
  const spaced = String(rawQuery ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const packed = compact(spaced);
  const found: string[] = [];
  for (const [id, spec] of Object.entries(VENUE_SURFACES)) {
    if (spec.phrases.some((p) => textHasPhrase(spaced, packed, p))) found.push(id);
  }
  return uniq(found);
}

export function collectPositiveVenues(args: {
  venueIntents?: string[];
  purposeIntents?: string[];
  menuIntents?: string[];
  rawQuery?: string;
}): string[] {
  const fromQuery = args.rawQuery ? collectPositiveVenuesFromQuery(args.rawQuery) : [];
  const fromPurpose = (args.purposeIntents ?? [])
    .map(venueIdFromPurpose)
    .filter((x): x is string => Boolean(x));
  const fromMenu = (args.menuIntents ?? [])
    .map(venueIdFromMenu)
    .filter((x): x is string => Boolean(x));
  return uniq([...(args.venueIntents ?? []), ...fromQuery, ...fromPurpose, ...fromMenu]);
}

export function reconcileVenuePolarity(
  positiveVenues: string[],
  excludedVenues: string[]
): VenuePolarityDebug {
  const positiveBefore = uniq(positiveVenues);
  const excluded = uniq(excludedVenues);
  const excludedSet = new Set(excluded);
  const positiveAfter = positiveBefore.filter((v) => !excludedSet.has(v));
  const removedByExclusion = positiveBefore.filter((v) => excludedSet.has(v));
  return {
    positiveBefore,
    excludedVenues: excluded,
    positiveAfter,
    removedByExclusion,
    contradictionResolved: removedByExclusion.length > 0,
  };
}

export function stripExcludedVenueSurfaces(
  purposeIntents: string[] | undefined,
  menuIntents: string[] | undefined,
  excludedVenues: string[]
): { purposeIntents: string[]; menuIntents: string[] } {
  const excluded = new Set(uniq(excludedVenues));
  const dropPurpose = new Set<string>();
  const dropMenu = new Set<string>();
  for (const id of excluded) {
    const spec = VENUE_SURFACES[id];
    if (!spec) continue;
    for (const p of spec.purposes) dropPurpose.add(p);
    for (const m of spec.menus) dropMenu.add(m);
  }
  return {
    purposeIntents: (purposeIntents ?? []).filter((p) => !dropPurpose.has(p)),
    menuIntents: (menuIntents ?? []).filter((m) => !dropMenu.has(m)),
  };
}

export function applyVenuePolarityToParsedQuery(parsed: ParsedRecommendationQuery): ParsedRecommendationQuery {
  const excluded = parsed.negation?.excludedVenues ?? [];
  const positiveBefore = collectPositiveVenues({
    venueIntents: parsed.venueIntents,
    purposeIntents: parsed.purposeIntents,
    menuIntents: parsed.menuIntents,
    rawQuery: parsed.rawQuery,
  });
  const debug = reconcileVenuePolarity(positiveBefore, excluded);
  const stripped = stripExcludedVenueSurfaces(parsed.purposeIntents, parsed.menuIntents, excluded);
  return {
    ...parsed,
    venueIntents: debug.positiveAfter,
    purposeIntents: stripped.purposeIntents,
    menuIntents: stripped.menuIntents,
    venuePolarity: debug,
  };
}
