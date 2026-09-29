"use client";

import React from "react";
import { colors, radius } from "@/lib/designTokens";
import type { HomeCard } from "@/lib/storeTypes";

type Props = {
  cards: HomeCard[];
  loading: boolean;
  anchorName: string | null;
  provisional: boolean;
  needsCoords: boolean;
  playChoices: HomeCard[];
  onPickAnchor: (id: string) => void;
  onOpen: (card: HomeCard) => void;
  onDirections: (card: HomeCard) => void;
};

export function LinkedFoodGroup({
  cards,
  loading,
  anchorName,
  provisional,
  needsCoords,
  playChoices,
  onPickAnchor,
  onOpen,
  onDirections,
}: Props) {
  return (
    <section
      aria-label="식사 추천"
      style={{
        marginTop: 18,
        padding: 14,
        borderRadius: radius.button,
        background: colors.primaryLight,
        border: `1px solid ${colors.borderSubtle}`,
      }}
    >
      <h2 style={{ margin: "0 0 8px", fontSize: 16, color: colors.textPrimary }}>식사</h2>
      {anchorName ? (
        <p style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.45, color: colors.textSecondary }}>
          {provisional ? `임시 기준은 ${anchorName}예요. ` : `거리 기준은 ${anchorName}예요. `}
          표시된 거리는 직선거리이고, 실제 이동시간이 아닙니다.
        </p>
      ) : null}
      {needsCoords ? (
        <p style={{ margin: "0 0 8px", fontSize: 14, lineHeight: 1.45, color: colors.textPrimary }}>
          기준이 될 놀이 장소에 좌표가 없어 직선거리를 계산하지 않았어요.
        </p>
      ) : null}
      {playChoices.length > 1 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {playChoices.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onPickAnchor(card.id)}
              style={{
                border: `1px solid ${colors.borderSubtle}`,
                background: "#fff",
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {card.name} 기준
            </button>
          ))}
        </div>
      ) : null}
      {loading ? <p style={{ fontSize: 14, color: colors.textSecondary }}>식당을 고르는 중이에요.</p> : null}
      {!loading && cards.length === 0 ? (
        <p style={{ fontSize: 14, color: colors.textPrimary }}>조건에 맞는 식당이 없어요. 다른 장소로 채우지 않았어요.</p>
      ) : null}
      {!loading && cards.length > 0 ? (
        <ol style={{ margin: 0, paddingLeft: 18, color: colors.textPrimary }}>
          {cards.map((card, index) => {
            const km =
              anchorName && typeof card.distanceKm === "number" && Number.isFinite(card.distanceKm)
                ? `직선거리 ${card.distanceKm.toFixed(1)}km`
                : null;
            return (
              <li key={card.id} data-hama-food-id={card.id} style={{ marginBottom: 8 }}>
                <span>
                  {index + 1}. {card.name}
                </span>
                {km ? <span> · {km}</span> : null}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={() => onOpen(card)}>
                    상세 보기
                  </button>
                  <button type="button" onClick={() => onDirections(card)}>
                    길찾기
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
