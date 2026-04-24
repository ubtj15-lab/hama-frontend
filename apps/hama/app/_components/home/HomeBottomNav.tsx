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
      gap: 3,
      color: on ? colors.accentPrimary : colors.textMuted,
      fontSize: 12,
      fontWeight: on ? 800 : 700,
      cursor: "pointer",
      minWidth: 56,
    }) as const;

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
          height: 66,
          borderRadius: radius.card,
          border: `1px solid ${colors.borderSubtle}`,
          background: "#fff",
          boxShadow: "0 8px 20px rgba(17,24,39,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
        }}
      >
        <button type="button" style={itemStyle(active === "home")} onClick={() => router.push("/")}>
          <span>🏠</span>
          <span>홈</span>
        </button>
        <button type="button" style={itemStyle(active === "saved")} onClick={() => router.push("/my")}>
          <span>🔖</span>
          <span>저장</span>
        </button>
        <button type="button" style={itemStyle(active === "history")} onClick={() => router.push("/calendar")}>
          <span>🕘</span>
          <span>기록</span>
        </button>
        <button type="button" style={itemStyle(active === "my")} onClick={() => router.push("/my")}>
          <span>👤</span>
          <span>MY</span>
        </button>
      </div>
    </nav>
  );
}
