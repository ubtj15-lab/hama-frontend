"use client";

import React from "react";
import { colors, radius, shadow } from "@/lib/designTokens";

type Props = {
  onAlertClick?: () => void;
};

export default function HomeTopBar({ onAlertClick }: Props) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <strong style={{ fontSize: 24, letterSpacing: "-0.03em", color: colors.textPrimary }}>HAMA</strong>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: colors.textSecondary,
            background: "#fff",
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: radius.pill,
            padding: "5px 10px",
          }}
        >
          오산·동탄
        </span>
      </div>
      <button
        type="button"
        aria-label="알림"
        onClick={onAlertClick}
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.pill,
          border: `1px solid ${colors.borderSubtle}`,
          background: "#fff",
          boxShadow: shadow.headerBtn,
          cursor: "pointer",
          fontSize: 17,
          color: colors.textPrimary,
        }}
      >
        🔔
      </button>
    </header>
  );
}
