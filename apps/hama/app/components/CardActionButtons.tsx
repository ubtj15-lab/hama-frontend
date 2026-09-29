// app/components/CardActionButtons.tsx
"use client";

import React from "react";
import type { HomeCard } from "@/lib/storeTypes";
import { openNaverPlace } from "@/lib/openNaverPlace";
import { openDirections } from "@/lib/openDirections";
import { naverPlaceButtonLabel, resolveNaverPlaceLink } from "@/lib/placeExternalUrl";

type Props = {
  card: HomeCard;
};

export default function CardActionButtons({ card }: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        justifyContent: "center",
        padding: "14px 14px 18px",
      }}
    >
      <button
        type="button"
        onClick={() => openDirections(card)}
        style={btnStyle}
      >
        길안내
      </button>

      <button
        type="button"
        onClick={() => openNaverPlace(card)}
        style={btnStyle}
      >
        {naverPlaceButtonLabel(resolveNaverPlaceLink(card))}
      </button>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  flex: 1,
  maxWidth: 170,
  borderRadius: 999,
  border: "none",
  padding: "12px 0",
  fontSize: 14,
  fontWeight: 800,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 10px 26px rgba(15,23,42,0.18)",
  cursor: "pointer",
};
