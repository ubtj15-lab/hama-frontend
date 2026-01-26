// app/components/search/SearchResultList.tsx
"use client";

import React from "react";
import type { HomeCard } from "@/lib/storeTypes";

type Props = {
  items: HomeCard[];
  onSelect?: (card: HomeCard) => void;
};

function getNaverMobilePlaceUrl(card: HomeCard): string | null {
  const id = (card as any)?.naver_place_id as string | undefined | null;
  if (!id) return null;
  return `https://m.place.naver.com/place/${id}`;
}

function getExternalPlaceUrl(card: HomeCard): string | null {
  // 1) 네이버 place id가 있으면 네이버 "모바일 place"로 (오른쪽 스샷 형태에 제일 가까움)
  const naverUrl = getNaverMobilePlaceUrl(card);
  if (naverUrl) return naverUrl;

  // 2) 없으면 DB에 있는 링크(카카오/네이버 me 등) 사용
  const kakaoOrEtc = (card as any)?.kakao_place_url as string | undefined | null;
  if (kakaoOrEtc) return kakaoOrEtc;

  return null;
}

export default function SearchResultList({ items, onSelect }: Props) {
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: 12, color: "#64748b", fontSize: 13 }}>
        검색 결과가 없어요.
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
          const url = getExternalPlaceUrl(p);
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
