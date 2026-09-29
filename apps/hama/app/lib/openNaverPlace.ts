"use client";

import { openResolvedPlaceLink, resolveNaverPlaceLink, type PlaceLinkFields } from "@/lib/placeExternalUrl";

type Params = PlaceLinkFields & {
  name?: string | null;
  naverPlaceId?: string | null;
  naverPlaceUrl?: string | null;
};

export function openNaverPlace(params: Params) {
  openResolvedPlaceLink(resolveNaverPlaceLink(params));
}
