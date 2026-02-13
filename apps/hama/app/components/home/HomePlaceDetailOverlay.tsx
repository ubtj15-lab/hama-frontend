// components/home/HomePlaceDetailOverlay.tsx
"use client";

import React from "react";
import Image from "next/image";
import type { HomeCard } from "@/lib/storeTypes";

type DetailAction = "예약" | "길안내" | "평점" | "메뉴";

interface HomePlaceDetailOverlayProps {
  card: HomeCard | null;
  onClose: () => void;
  onAction: (action: DetailAction, card: HomeCard) => void;
}

export default function HomePlaceDetailOverlay({
  card,
  onClose,
  onAction,
}: HomePlaceDetailOverlayProps) {
  if (!card) return null;

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
      {/* 바깥 클릭 시 닫힘 */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
        }}
      />

      {/* 가운데 큰 카드 컨테이너 */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 430,
          height: "100%",
          maxHeight: 820,
          padding: "16px 12px 96px",
          boxSizing: "border-box",
        }}
      >
        {/* 실제 카드 */}
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
        >
          {/* 상단 전체 이미지 */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
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

            {/* 상단 좌측 뒤로가기 버튼 */}
            <button
              type="button"
              onClick={onClose}
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                width: 32,
                height: 32,
                borderRadius: 999,
                border: "none",
                background: "rgba(15,23,42,0.65)",
                color: "#f9fafb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              ←
            </button>

            {/* 하단 그라디언트 + 상호/카테고리 라벨 */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: "20px 20px 20px",
                background:
                  "linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.85) 100%)",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.75)",
                  color: "#f9fafb",
                  fontSize: 11,
                  marginBottom: 10,
                }}
              >
                {card.name} · {card.categoryLabel}
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: "#e5e7eb",
                }}
              >
                {card.moodText}
              </div>
            </div>
          </div>
        </div>

        {/* 하단 액션 버튼들 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 16,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            padding: "0 20px",
            boxSizing: "border-box",
          }}
        >
          {(["예약", "길안내", "평점", "메뉴"] as DetailAction[]).map(
            (label) => (
              <button
                key={label}
                type="button"
                onClick={() => onAction(label, card)}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 999,
                  border: "none",
                  background: "#f9fafb",
                  color: "#111827",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
