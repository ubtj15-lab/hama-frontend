"use client";

import React from "react";
import type { Place } from "@lib/storeTypes";
import { logEvent } from "@lib/logEvent";

interface Props {
  place: Place;
}

export default function RecommendCard({ place }: Props) {
  const handleClick = () => {
    logEvent("recommend_card_click", {
      place_id: place.id,
    });

    if (place.placeUrl) {
      window.open(place.placeUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        minWidth: 180,
        maxWidth: 200,
        borderRadius: 18,
        border: "none",
        background: "#ffffff",
        padding: 12,
        boxShadow: "0 6px 14px rgba(15,23,42,0.18)",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 4,
        }}
      >
        {place.name}
      </div>

      {place.address && (
        <div
          style={{
            fontSize: 11,
            color: "#6b7280",
            marginBottom: 4,
          }}
        >
          {place.address}
        </div>
      )}

      {place.distance != null && (
        <div style={{ fontSize: 11, color: "#0f766e" }}>
          약 {place.distance}m 거리
        </div>
      )}
    </button>
  );
}
