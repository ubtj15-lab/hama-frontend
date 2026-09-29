// app/components/search/SearchResultList.tsx
"use client";

import React from "react";
import type { HomeCard } from "@/lib/storeTypes";
import { directExternalPlaceUrl } from "@/lib/placeExternalUrl";

type Props = {
  items: HomeCard[];
  onSelect?: (card: HomeCard) => void;
};

export default function SearchResultList({ items, onSelect }: Props) {
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: 12, color: "#64748b", fontSize: 13 }}>
        하마가 학습 중이에요
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((p) => {
        const distanceKm = (p as any)?.distanceKm as number | undefined | null;
        const phone = (p as any)?.phone as string | undefined | null;
        const address = (p as any)?.address as string | undefined | null;

        const distanceText =
          distanceKm != null && Number.isFinite(distanceKm)
            ? `${Math.round(distanceKm * 1000)}m`
            : null;

        const subLineParts: string[] = [];
        if (p.categoryLabel) subLineParts.push(p.categoryLabel);
        else if (p.category) subLineParts.push(String(p.category));

        if (distanceText) subLineParts.push(distanceText);
        if (phone) subLineParts.push(phone);

        const subLine = subLineParts.join(" · ");

        const onClick = () => {
          // 1) 카드 상세(네 앱 내부) 열기
          onSelect?.(p);

          // 2) 외부로도 열고 싶으면(원하면 이 줄만 살려)
          const url = directExternalPlaceUrl(p);
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        };

        return (
          <button
            key={p.id}
            type="button"
            onClick={onClick}
            style={{
              width: "100%",
              textAlign: "left",
              border: "none",
              background: "#ffffff",
              borderRadius: 14,
              padding: "12px 12px",
              boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
              {p.name}
            </div>

            {subLine ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                {subLine}
              </div>
            ) : null}

            {address ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "#334155" }}>
                {address}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
