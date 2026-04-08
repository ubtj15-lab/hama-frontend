import type { HomeCard } from "@/lib/storeTypes";

const KEY = (id: string) => `hama_place_${id}`;

export function stashPlaceForSession(card: HomeCard): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY(card.id), JSON.stringify(card));
  } catch {}
}

export function readPlaceFromSession(id: string): HomeCard | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY(id));
    if (!raw) return null;
    return JSON.parse(raw) as HomeCard;
  } catch {
    return null;
  }
}
