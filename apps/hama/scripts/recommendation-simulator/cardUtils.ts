import type { CatalogCard } from "./types";

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function cardDistanceKm(
  card: CatalogCard,
  origin: { lat: number; lng: number } | null | undefined
): number | null {
  if (!origin) return null;
  if (typeof card.lat !== "number" || typeof card.lng !== "number") return null;
  if (!Number.isFinite(card.lat) || !Number.isFinite(card.lng)) return null;
  return haversineKm(origin, { lat: card.lat, lng: card.lng });
}

export function cardTextBlob(card: CatalogCard): string {
  return [
    card.name,
    card.category,
    card.area,
    card.address,
    card.description,
    ...(card.tags ?? []),
    ...(card.mood ?? []),
    ...(card.menu_keywords ?? []),
    ...(card.search_keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function compact(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function normalizeCategoryKey(category: string | null | undefined): string {
  const c = String(category ?? "")
    .toLowerCase()
    .trim();
  if (c === "fd6" || c.includes("restaurant") || c.includes("food")) return "restaurant";
  if (c === "ce7" || c.includes("cafe") || c.includes("coffee")) return "cafe";
  if (c === "bk9" || c === "beauty" || c.includes("salon")) return "salon";
  if (c === "at4" || c.includes("activity") || c === "library" || c === "museum") return "activity";
  return c || "unknown";
}

export function dedupeCards(cards: CatalogCard[]): CatalogCard[] {
  const m = new Map<string, CatalogCard>();
  for (const c of cards) {
    if (c.id && !m.has(c.id)) m.set(c.id, c);
  }
  return [...m.values()];
}

export function sortByUpdatedAtDesc(cards: CatalogCard[]): CatalogCard[] {
  return [...cards].sort((a, b) => {
    const ta = Date.parse(String(a.updated_at ?? "")) || 0;
    const tb = Date.parse(String(b.updated_at ?? "")) || 0;
    return tb - ta;
  });
}
