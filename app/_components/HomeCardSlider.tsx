"use client";

import React from "react";
import Image from "next/image";
import type { HomeCard } from "@lib/storeTypes";


export default function HomeCardSlider({
  cards,
  activeIndex,
  onChangeIndex,
  onClickCard,
}: {
  cards: HomeCard[];
  activeIndex: number;
  onChangeIndex: (i: number) => void;
  onClickCard: (c: HomeCard) => void;
}) {
  return (
    <section style={{ marginTop: 24, marginBottom: 40 }}>
      <div style={{ position: "relative", height: 340 }}>
        {cards.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#6B7280" }}>
            주변 매장을 불러오는 중이에요…
          </div>
        )}

        {cards.map((card, idx) => {
          const offset = idx - activeIndex;
          const abs = Math.abs(offset);
          if (abs > 2) return null;

          const depth = Math.min(abs, 2);
          const scale = depth === 0 ? 1 : depth === 1 ? 0.93 : 0.86;
          const translateX = offset * 18;

          const distanceKm =
            typeof (card as any).distanceKm === "number" && !Number.isNaN((card as any).distanceKm)
              ? (card as any).distanceKm
              : null;
          const distanceLabel = distanceKm !== null ? `${distanceKm.toFixed(1)} km` : "";

          const moodText = ((card as any).mood?.trim?.() ? (card as any).mood : (card as any).moodText) ?? "";
          const tags = (card as any).tags ? (card as any).tags.slice(0, 3) : [];

          return (
            <button
              key={(card as any).id}
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
                boxShadow: depth === 0 ? "0 22px 45px rgba(15,23,42,0.30)" : depth === 1 ? "0 16px 34px rgba(15,23,42,0.20)" : "0 10px 24px rgba(15,23,42,0.14)",
                transform: `translateX(${translateX}px) scale(${scale})`,
                transition: "transform 0.35s ease, opacity 0.3s ease, box-shadow 0.3s ease",
                zIndex: 99 - abs,
              }}
            >
              <div style={{ position: "relative", flex: 1, background: "linear-gradient(135deg,#dbeafe 0%,#bfdbfe 100%)" }}>
                {(card as any).imageUrl && (
                  <Image src={(card as any).imageUrl} alt={(card as any).name} fill style={{ objectFit: "cover" }} />
                )}
              </div>

              <div style={{ padding: "18px 20px 20px", background: "#fff" }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: "#111827" }}>{(card as any).name}</h2>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 6 }}>
                  {(card as any).categoryLabel}
                  {distanceLabel ? ` · ${distanceLabel}` : ""}
                </div>

                <div style={{ fontSize: 13, color: "#4B5563", marginBottom: 8 }}>{moodText}</div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                  {(card as any).withKids && (
                    <span style={{ padding: "3px 8px", borderRadius: 999, background: "#FEF3C7", fontSize: 11, color: "#92400E" }}>
                      아이랑 가기 좋아요
                    </span>
                  )}
                  {(card as any).forWork && (
                    <span style={{ padding: "3px 8px", borderRadius: 999, background: "#DBEAFE", fontSize: 11, color: "#1D4ED8" }}>
                      작업·공부하기 좋음
                    </span>
                  )}
                  {typeof (card as any).priceLevel === "number" && (card as any).priceLevel > 0 && (
                    <span style={{ padding: "3px 8px", borderRadius: 999, background: "#ECFDF5", fontSize: 11, color: "#047857" }}>
                      {"₩".repeat((card as any).priceLevel)}
                    </span>
                  )}
                  {tags.map((t: string) => (
                    <span key={t} style={{ padding: "3px 8px", borderRadius: 999, background: "#F3F4F6", fontSize: 11, color: "#374151" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 6 }}>
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
              background: idx === activeIndex ? "#2563EB" : "rgba(148,163,184,0.6)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          />
        ))}
      </div>
    </section>
  );
}
