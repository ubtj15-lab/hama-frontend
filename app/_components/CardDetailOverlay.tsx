"use client";

import React from "react";
import Image from "next/image";
import type { HomeCard } from "@lib/storeTypes";


export default function CardDetailOverlay({
  card,
  onClose,
  onAction,
}: {
  card: HomeCard | null;
  onClose: () => void;
  onAction: (label: string) => void;
}) {
  if (!card) return null;

  const name = (card as any).name;
  const categoryLabel = (card as any).categoryLabel;
  const mood = (card as any).mood ?? (card as any).moodText;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 430, height: "100%", maxHeight: 820, padding: "16px 12px 96px", boxSizing: "border-box" }}>
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 32, overflow: "hidden", background: "#111827", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            {(card as any).imageUrl && <Image src={(card as any).imageUrl} alt={name} fill style={{ objectFit: "cover" }} />}

            <button
              type="button"
              onClick={onClose}
              style={{ position: "absolute", top: 16, left: 16, width: 32, height: 32, borderRadius: 999, border: "none", background: "rgba(15,23,42,0.65)", color: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              ←
            </button>

            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "20px 20px 20px", background: "linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.85) 100%)" }}>
              <div style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 999, background: "rgba(15,23,42,0.75)", color: "#f9fafb", fontSize: 11, marginBottom: 10 }}>
                {name} · {categoryLabel}
              </div>
              <div style={{ fontSize: 14, color: "#e5e7eb" }}>{mood}</div>
            </div>
          </div>
        </div>

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 16, display: "flex", justifyContent: "space-between", gap: 10, padding: "0 20px", boxSizing: "border-box" }}>
          {["예약", "길안내", "평점", "메뉴"].map((label) => (
            <button
              key={label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAction(label);
                if (label === "길안내") alert("길안내 기능은 다음 버전에서 지도로 연결할게요!");
                else if (label === "예약") alert("예약 기능은 사장님 플랫폼 붙이면서 열릴 예정이에요 🙂");
                else if (label === "평점") alert("평점/후기 기능은 하마 커뮤와 함께 붙을 예정이에요!");
                else alert("메뉴 정보는 추후 실제 매장 데이터 연동 시 노출됩니다.");
              }}
              style={{ flex: 1, height: 40, borderRadius: 999, border: "none", background: "#f9fafb", color: "#111827", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
