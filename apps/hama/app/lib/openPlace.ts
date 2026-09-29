// app/lib/openPlace.ts
"use client";

import type { HomeCard } from "@/lib/storeTypes";
import { openResolvedPlaceLink, resolveKakaoPlaceLink, resolveNaverPlaceLink } from "@/lib/placeExternalUrl";

type Provider = "naver" | "kakao";

export function openPlace(card: Partial<HomeCard>, provider: Provider) {
  if (provider === "naver") {
    openResolvedPlaceLink(resolveNaverPlaceLink(card));
    return;
  }
  openResolvedPlaceLink(resolveKakaoPlaceLink(card));
}
