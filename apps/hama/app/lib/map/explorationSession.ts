import type { HomeCard } from "@/lib/storeTypes";

export const EXPLORATION_MAP_STORAGE_KEY = "hama_exploration_map_v1";

export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function asCard(value: unknown): HomeCard | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<HomeCard>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!id || !name) return null;
  return { ...(row as HomeCard), id, name };
}

function extractList(parsed: unknown): unknown[] | null {
  if (!parsed || typeof parsed !== "object") return null;
  const cards = (parsed as { version?: unknown; cards?: unknown }).cards;
  if ((parsed as { version?: unknown }).version !== 1 || !Array.isArray(cards)) return null;
  return cards;
}

/** Persist the recommendation list in its current order. */
export function writeExplorationCards(cards: readonly HomeCard[], storage: KeyValueStorage): void {
  storage.setItem(
    EXPLORATION_MAP_STORAGE_KEY,
    JSON.stringify({ version: 1, cards: cards.map((card) => ({ ...card })) })
  );
}

/**
 * Returns the stored list, an empty list when the payload is valid but has no usable cards,
 * or null when the session is missing or damaged.
 */
export function readExplorationCards(storage: KeyValueStorage | null): HomeCard[] | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(EXPLORATION_MAP_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const list = extractList(parsed);
  if (!list) return null;
  return list.map(asCard).filter((card): card is HomeCard => card != null);
}

export function stashExplorationCards(cards: readonly HomeCard[]): void {
  if (typeof window === "undefined") return;
  try {
    writeExplorationCards(cards, window.sessionStorage);
  } catch {
    /* quota or private mode */
  }
}

export function loadExplorationCards(): HomeCard[] | null {
  if (typeof window === "undefined") return null;
  return readExplorationCards(window.sessionStorage);
}
