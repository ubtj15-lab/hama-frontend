"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { logEvent } from "@/lib/logEvent";
import { HOME_PURPLE } from "./homeBetaTheme";

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
      gap: 3,
      color: on ? HOME_PURPLE : "#9A958C",
      fontSize: 11,
      fontWeight: on ? 800 : 700,
      cursor: "pointer",
      minWidth: 56,
      flex: 1,
      padding: "8px 0 6px",
    }) as const;

  const iconWrap = { fontSize: 22, lineHeight: 1 } as const;

  return (
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        background: "#fff",
        borderTop: "1px solid #EFEAE3",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        style={{
          maxWidth: 430,
          margin: "0 auto",
          minHeight: 62,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-around",
        }}
      >
        <button
          type="button"
          style={itemStyle(active === "home")}
          onClick={() => {
            logEvent("bottom_nav_click", { tab: "home" });
            router.push("/");
          }}
        >
          <span style={iconWrap}>🏠</span>
          <span>홈</span>
        </button>
        <button
          type="button"
          style={itemStyle(active === "saved")}
          onClick={() => {
            logEvent("bottom_nav_click", { tab: "saved" });
            router.push("/my");
          }}
        >
          <span style={iconWrap}>🔖</span>
          <span>저장</span>
        </button>
        <button
          type="button"
          style={itemStyle(active === "history")}
          onClick={() => {
            logEvent("bottom_nav_click", { tab: "history" });
            router.push("/mypage/points");
          }}
        >
          <span style={iconWrap}>🕘</span>
          <span>기록</span>
        </button>
        <button
          type="button"
          style={itemStyle(active === "my")}
          onClick={() => {
            logEvent("bottom_nav_click", { tab: "my" });
            router.push("/my");
          }}
        >
          <span style={iconWrap}>👤</span>
          <span>MY</span>
        </button>
      </div>
    </nav>
  );
}
