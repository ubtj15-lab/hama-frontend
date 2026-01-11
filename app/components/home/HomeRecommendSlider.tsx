// components/home/HomeRecommendSlider.tsx
"use client";

import React from "react";
import Image from "next/image";
import type { HomeCard } from "@/lib/storeTypes";

interface HomeRecommendSliderProps {
  cards: HomeCard[];
  activeIndex: number;
  onChangeIndex: (index: number) => void;
  onClickCard: (card: HomeCard) => void;
}

export default function HomeRecommendSlider({
  cards,
  activeIndex,
  onChangeIndex,
  onClickCard,
}: HomeRecommendSliderProps) {
  return (
    <section
      style={{
        marginTop: 24,
        marginBottom: 40,
      }}
    >
      <div
        style={{
          position: "relative",
          height: 340,
        }}
      >
        {cards.map((card, idx) => {
          const offset = idx - activeIndex;
          const absOffset = Math.abs(offset);

          if (absOffset > 2) return null;

          const depth = Math.min(absOffset, 2);

          const scale = depth === 0 ? 1 : depth === 1 ? 0.93 : 0.86;
          const translateX = offset * 18;

          const boxShadow =
            depth === 0
              ? "0 22px 45px rgba(15,23,42,0.30)"
              : depth === 1
              ? "0 16px 34px rgba(15,23,42,0.20)"
              : "0 10px 24px rgba(15,23,42,0.14)";

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onClickCard(card)}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                margin: "0 auto",
                maxWidth: 360,
                height: 340,
                border: "none",
                padding: 0,
                cursor: "pointer",
                borderRadius: 32,
                overflow: "hidden",
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                textAlign: "left",
                boxShadow,
                transform: `translateX(${translateX}px) scale(${scale})`,
                transition:
                  "transform 0.35s ease, opacity 0.3s ease, box-shadow 0.3s ease",
                zIndex: 99 - absOffset,
                opacity: 1,
              }}
            >
              {/* 상단 이미지 */}
              <div
                style={{
                  position: "relative",
                  flex: 1,
                  background:
                    "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
                }}
              >
                {card.imageUrl && (
                  <Image
                    src={card.imageUrl}
                    alt={card.name}
                    fill
                    style={{ objectFit: "cover" }}
                  />
                )}
              </div>

              {/* 하단 정보 */}
              <div
                style={{
                  padding: "18px 20px 20px",
                  background: "#ffffff",
                }}
              >
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    marginBottom: 6,
                    color: "#111827",
                  }}
                >
                  {card.name}
                </h2>

                <div
                  style={{
                    fontSize: 13,
                    color: "#6B7280",
                    marginBottom: 8,
                  }}
                >
                  {card.categoryLabel} · {card.distanceKm.toFixed(1)} km
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "#4B5563",
                  }}
                >
                  {card.moodText}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 인디케이터 점 */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {cards.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onChangeIndex(idx)}
            style={{
              width: idx === activeIndex ? 16 : 8,
              height: 8,
              borderRadius: 999,
              border: "none",
              padding: 0,
              background:
                idx === activeIndex ? "#2563EB" : "rgba(148,163,184,0.6)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          />
        ))}
      </div>
    </section>
  );
}
