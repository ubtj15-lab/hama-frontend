import type { HomeCard } from "@/lib/storeTypes";

/**
 * Matches current `openDirections` behavior (Kakao Map app / web). Naver is not used there.
 */
export function inferDirectionsProvider(card: HomeCard): "kakao" | "naver" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  const _ua = navigator.userAgent || "";
  const lat = card.lat;
  const lng = card.lng;
  if (typeof lat === "number" && typeof lng === "number") return "kakao";
  return "kakao";
}
