"use client";

import { openResolvedPlaceLink, resolveKakaoPlaceLink, type PlaceLinkFields } from "@/lib/placeExternalUrl";

export function openKakaoPlace(params: PlaceLinkFields & { name?: string | null; kakaoPlaceUrl?: string | null }) {
  openResolvedPlaceLink(resolveKakaoPlaceLink(params));
}
