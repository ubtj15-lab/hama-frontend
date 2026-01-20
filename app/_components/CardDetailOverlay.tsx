"use client";

import React from "react";
import Image from "next/image";
import type { HomeCard } from "@/lib/storeTypes";

type ActionKey = "예약" | "길안내" | "평점" | "메뉴";

type Props = {
  card: HomeCard;
  onClose: () => void;
  onAction: (card: HomeCard, action: ActionKey) => void;
};

export default function CardDetailOverlay({ card, onClose, onAction }: Props) {
  const anyCard = card as any;
  const imageUrl: string | undefined = anyCard.imageUrl ?? anyCard.image ?? undefined;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(15,23,42,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 바깥 클릭 닫기 */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }} />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 430,
          height: "100%",
          maxHeight: 820,
          padding: "16px 12px 16px",
          boxSizing: "border-box",
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 32,
            overflow: "hidden",
            background: "#111827",
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 이미지 */}
          <div style={{ position: "absolute", inset: 0 }}>
            {imageUrl ? (
              <Image src={imageUrl} alt={anyCard.name ?? "place"} fill style={{ objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "#0b1220" }} />
            )}
          </div>

          {/* 상단 뒤로 */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              width: 36,
              height: 36,
              borderRadius: 999,
              border: "none",
              background: "rgba(15,23,42,0.6)",
              color: "#f9fafb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 10,
            }}
          >
            ←
          </button>

          {/* 하단 그라데이션 + 텍스트 */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "22px 20px 110px",
              background: "linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.85) 75%, rgba(15,23,42,0.92) 100%)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: "#f9fafb", marginBottom: 8 }}>
              {anyCard.name}
            </div>
            <div style={{ fontSize: 12, color: "#cbd5e1" }}>
              {(anyCard.categoryLabel ?? anyCard.category) ? `${anyCard.categoryLabel ?? anyCard.category}` : ""}
            </div>
          </div>

          {/* ✅ 하단 액션바 (safe-area 포함 고정) */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "0 16px",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
              zIndex: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "space-between",
              }}
            >
              {(["예약", "길안내", "평점", "메뉴"] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(card, label);
                  }}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 999,
                    border: "none",
                    background: "rgba(249,250,251,0.95)",
                    color: "#111827",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
