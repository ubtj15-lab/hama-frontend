import type { HomeCard } from "@/lib/storeTypes";

export const EXPLORATION_MAP_SOURCE = "recommend";
export const HAMA_MAP_IVORY = "#FFFDFB";
export const HAMA_MAP_CREAM = "#F4F0E6";
export const HAMA_MAP_GREEN = "#7FA882";
export const HAMA_MAP_GREEN_DEEP = "#4F7A55";

export type MappablePlace = {
  card: HomeCard;
  lat: number;
  lng: number;
  /** 1-based index in the original recommendation list. */
  order: number;
};

export type CoordinateBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type ExplorationPanel = {
  name: string;
  reason: string;
  distance: string | null;
};

export type MapPresentation =
  | { mode: "single" }
  | { mode: "explore"; places: MappablePlace[] }
  | { mode: "missing" };

function finiteCoord(value: unknown, min: number, max: number): number | null {
  let n = Number.NaN;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && value.trim() !== "") n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/** Keeps recommendation order and drops places that cannot be drawn. */
export function mappablePlaces(cards: readonly HomeCard[]): MappablePlace[] {
  const places: MappablePlace[] = [];
  cards.forEach((card, index) => {
    const lat = finiteCoord(card?.lat, -90, 90);
    const lng = finiteCoord(card?.lng, -180, 180);
    if (lat == null || lng == null) return;
    if (!card?.id || !card?.name) return;
    places.push({ card, lat, lng, order: index + 1 });
  });
  return places;
}

export function coordinateBounds(places: readonly { lat: number; lng: number }[]): CoordinateBounds | null {
  if (places.length === 0) return null;
  let minLat = places[0].lat;
  let maxLat = places[0].lat;
  let minLng = places[0].lng;
  let maxLng = places[0].lng;
  for (const place of places) {
    minLat = Math.min(minLat, place.lat);
    maxLat = Math.max(maxLat, place.lat);
    minLng = Math.min(minLng, place.lng);
    maxLng = Math.max(maxLng, place.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}

export function boundsAreSinglePoint(bounds: CoordinateBounds): boolean {
  return bounds.minLat === bounds.maxLat && bounds.minLng === bounds.maxLng;
}

export function explorationPanel(card: HomeCard): ExplorationPanel {
  const name = String(card.name ?? "").trim() || "추천 장소";
  const reason =
    String(card.reasonText ?? "").trim() ||
    String(card.recommendBadge?.primaryLabel ?? "").trim() ||
    "추천한 장소예요";
  const km = card.distanceKm;
  const distance = typeof km === "number" && Number.isFinite(km) && km >= 0 ? `${km.toFixed(1)}km` : null;
  return { name, reason, distance };
}

export function placeDetailHref(id: string): string {
  return `/place/${encodeURIComponent(id)}`;
}

export function explorationDirectionsInput(place: MappablePlace): {
  name: string;
  lat: number;
  lng: number;
} {
  return { name: place.card.name, lat: place.lat, lng: place.lng };
}

export function resolveMapPresentation(input: {
  source: string | null;
  cards: HomeCard[] | null;
}): MapPresentation {
  if (input.source !== EXPLORATION_MAP_SOURCE) return { mode: "single" };
  if (!input.cards) return { mode: "missing" };
  const places = mappablePlaces(input.cards);
  if (places.length === 0) return { mode: "missing" };
  return { mode: "explore", places };
}

export function markerStyle(selected: boolean): string {
  const background = selected ? HAMA_MAP_GREEN_DEEP : HAMA_MAP_IVORY;
  const color = selected ? HAMA_MAP_IVORY : HAMA_MAP_GREEN_DEEP;
  return [
    "width:36px",
    "height:36px",
    "padding:0",
    "border-radius:999px",
    `background:${background}`,
    `color:${color}`,
    `border:2px solid ${HAMA_MAP_GREEN}`,
    "font:700 14px/36px 'Noto Sans KR',sans-serif",
    "text-align:center",
    "box-shadow:0 6px 14px rgba(79,122,85,0.18)",
    "cursor:pointer",
  ].join(";");
}
