import type { HomeCard } from "@/lib/storeTypes";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function attachDistanceToCard(
  card: HomeCard,
  userLat: number | null | undefined,
  userLng: number | null | undefined
): HomeCard {
  if (userLat == null || userLng == null) return card;
  const lat = card.lat;
  const lng = card.lng;
  if (lat == null || lng == null) return card;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return card;
  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return card;
  return { ...card, distanceKm: haversineKm(userLat, userLng, lat, lng) };
}
