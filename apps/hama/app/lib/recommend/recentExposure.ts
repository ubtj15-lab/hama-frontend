"use client";

import type { HomeCard } from "@/lib/storeTypes";

const RECENT_EXPOSED_KEY = "hama_recent_exposed_store_ids";
const RECENT_EXPOSED_NAMES_KEY = "hama_recent_exposed_store_names";
const RECENT_EXPOSED_MAX = 10;

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getCardExposureId(card: HomeCard): string {
  const c = card as { place_id?: string | null; store_id?: string | null; id?: string | null };
  return String(c.place_id ?? c.store_id ?? c.id ?? "").trim();
}

export function readRecentExposedStoreIds(): string[] {
  const ss = getSessionStorage();
  if (!ss) return [];
  try {
    const raw = ss.getItem(RECENT_EXPOSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, RECENT_EXPOSED_MAX);
  } catch {
    return [];
  }
}

export function saveRecentExposedStoreIds(exposedIds: string[]): string[] {
  const ss = getSessionStorage();
  if (!ss) return [];
  const latest = exposedIds.map((x) => String(x ?? "").trim()).filter(Boolean);
  const prev = readRecentExposedStoreIds();
  const merged = [...latest, ...prev];
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const id of merged) {
    if (seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
    if (uniq.length >= RECENT_EXPOSED_MAX) break;
  }
  try {
    ss.setItem(RECENT_EXPOSED_KEY, JSON.stringify(uniq));
  } catch {}
  return uniq;
}

export function readRecentExposedStoreNames(): string[] {
  const ss = getSessionStorage();
  if (!ss) return [];
  try {
    const raw = ss.getItem(RECENT_EXPOSED_NAMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, RECENT_EXPOSED_MAX);
  } catch {
    return [];
  }
}

export function saveRecentExposedStoreNames(exposedNames: string[]): string[] {
  const ss = getSessionStorage();
  if (!ss) return [];
  const latest = exposedNames.map((x) => String(x ?? "").trim()).filter(Boolean);
  const prev = readRecentExposedStoreNames();
  const merged = [...latest, ...prev];
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const name of merged) {
    if (seen.has(name)) continue;
    seen.add(name);
    uniq.push(name);
    if (uniq.length >= RECENT_EXPOSED_MAX) break;
  }
  try {
    ss.setItem(RECENT_EXPOSED_NAMES_KEY, JSON.stringify(uniq));
  } catch {}
  return uniq;
}
