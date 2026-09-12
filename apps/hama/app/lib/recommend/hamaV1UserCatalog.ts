/**
 * HAMA V1 user-facing catalog eligibility.
 *
 * Holdem/poker-coded venues stay in the database (rows, events, logs, IDs)
 * but are not part of the supported user-facing place catalog.
 * Explicit holdem/poker queries do not re-enable them.
 *
 * Detection reuses `isHoldemPokerCodedVenue` (normalized name + tags/mood/
 * description/search keywords), not display-name-only checks.
 */

import { isHoldemPokerCodedVenue, type DiscoveryRerankItem } from "./discoveryRole";

export type HamaV1CatalogVenue = {
  id?: string | number | null;
  name?: string | null;
  category?: string | null;
  tags?: string[] | string | null;
  mood?: string[] | string | null;
  description?: string | null;
  searchKeywords?: string[] | null;
  search_keywords?: string[] | null;
  menu_keywords?: string[] | null;
};

function asStringList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const items = value.map((x) => String(x ?? "").trim()).filter(Boolean);
    return items.length ? items : null;
  }
  if (typeof value === "string") {
    const t = value.trim();
    return t ? [t] : null;
  }
  return null;
}

function toCatalogDiscoveryItem(venue: HamaV1CatalogVenue): DiscoveryRerankItem<HamaV1CatalogVenue> {
  const searchKeywords = [
    ...(asStringList(venue.searchKeywords) ?? []),
    ...(asStringList(venue.search_keywords) ?? []),
    ...(asStringList(venue.menu_keywords) ?? []),
  ];
  return {
    id: String(venue.id ?? venue.name ?? ""),
    name: String(venue.name ?? ""),
    category: venue.category ?? null,
    score: 0,
    tags: asStringList(venue.tags),
    mood: asStringList(venue.mood),
    description: venue.description ?? null,
    searchKeywords: searchKeywords.length ? searchKeywords : null,
    payload: venue,
  };
}

/** True when this venue must not appear in HAMA V1 user-facing discovery. */
export function isExcludedFromHamaV1UserCatalog(venue: HamaV1CatalogVenue): boolean {
  return isHoldemPokerCodedVenue(toCatalogDiscoveryItem(venue));
}

/** Drop holdem/poker-coded venues before ranking or candidate caps. */
export function filterHamaV1UserCatalog<T extends HamaV1CatalogVenue>(items: readonly T[]): T[] {
  return items.filter((item) => !isExcludedFromHamaV1UserCatalog(item));
}
