"use client";

import React from "react";
import type { Place } from "@lib/storeTypes";
import { logEvent } from "@lib/logEvent";

interface Props {
  results: Place[];
}

export default function SearchResultList({ results }: Props) {
  const handleClickPlace = (place: Place, index: number) => {
    logEvent("search_result_click", {
      place_id: place.id,
      rank: index + 1,
      from: "search_list",
    });

    if (place.placeUrl) {
      window.open(place.placeUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {results.map((p, idx) => (
        <button
          key={p.id ?? `${p.name}-${idx}`}
          type="button"
          onClick={() => handleClickPlace(p, idx)}
          style={{
            textAlign: "left",
            border: "none",
            borderRadius: 16,
            padding: 12,
            background: "#ffffff",
            boxShadow: "0 4px 10px rgba(15,23,42,0.12)",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#111827",
              marginBottom: 4,
            }}
          >
            {p.name}
          </div>

          {p.address && (
            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginBottom: 2,
              }}
            >
              {p.address}
            </div>
          )}

          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            {p.distance != null && (
              <span style={{ marginRight: 8 }}>{p.distance}m</span>
            )}
            {p.phone && <span>{p.phone}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}
