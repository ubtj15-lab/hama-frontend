"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { colors, radius } from "@/lib/designTokens";

type Props = {
  active?: "home" | "saved" | "history" | "my";
};

export function HomeBottomNav({ active = "home" }: Props) {
  const router = useRouter();

  const itemStyle = (on: boolean) =>
    ({
      border: "none",
      background: "transparent",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      color: on ? colors.accentPrimary : colors.textMuted,
      fontSize: 13,
      fontWeight: on ? 800 : 700,
      cursor: "pointer",
      minWidth: 56,
      flex: 1,
      padding: "6px 0 4px",
    }) as const;

  const iconWrap = { fontSize: 26, lineHeight: 1 } as const;

  return (
    <nav
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "max(12px, env(safe-area-inset-bottom, 0px))",
        width: "100%",
        maxWidth: 430,
        padding: "0 20px",
        zIndex: 100,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          minHeight: 76,
          borderRadius: radius.card,
          border: `1px solid ${colors.borderSubtle}`,
          background: "#fff",
          boxShadow: "0 8px 20px rgba(17,24,39,0.12)",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-around",
        }}
      >
        <button type="button" style={itemStyle(active === "home")} onClick={() => router.push("/")}>
          <span style={iconWrap}>🏠</span>
          <span>홈</span>
        </button>
        <button type="button" style={itemStyle(active === "saved")} onClick={() => router.push("/my")}>
          <span style={iconWrap}>🔖</span>
          <span>저장</span>
        </button>
        <button type="button" style={itemStyle(active === "history")} onClick={() => router.push("/calendar")}>
          <span style={iconWrap}>🕘</span>
          <span>기록</span>
        </button>
        <button type="button" style={itemStyle(active === "my")} onClick={() => router.push("/my")}>
          <span style={iconWrap}>👤</span>
          <span>MY</span>
        </button>
      </div>
    </nav>
  );
}
