"use client";

import React from "react";
import { openNaverPlace } from "@/lib/openNaverPlace";
import { openKakaoPlace } from "@/lib/openKakaoPlace";
import type { HomeCard } from "@/lib/storeTypes";
import {
  kakaoPlaceButtonLabel,
  naverPlaceButtonLabel,
  resolveKakaoPlaceLink,
  resolveNaverPlaceLink,
} from "@/lib/placeExternalUrl";

type Props = {
  card: HomeCard;
  className?: string;
};

export default function PlaceActionButtons({ card }: Props) {
  const naverLink = resolveNaverPlaceLink(card);
  const kakaoLink = resolveKakaoPlaceLink(card);

  if (!naverLink && !kakaoLink) return null;

  return (
    <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
      {naverLink ? (
        <button
          type="button"
          onClick={() => openNaverPlace(card)}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 12,
            border: "none",
            background: "#03C75A",
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {naverPlaceButtonLabel(naverLink)}
        </button>
      ) : null}

      {kakaoLink ? (
        <button
          type="button"
          onClick={() => openKakaoPlace(card)}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 12,
            border: "none",
            background: "#FEE500",
            color: "#000",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {kakaoPlaceButtonLabel(kakaoLink)}
        </button>
      ) : null}
    </div>
  );
}
