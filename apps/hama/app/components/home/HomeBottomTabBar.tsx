// components/home/HomeBottomTabBar.tsx
"use client";

import React from "react";

interface HomeBottomTabBarProps {
  onMyPageClick: () => void;
}

export default function HomeBottomTabBar({
  onMyPageClick,
}: HomeBottomTabBarProps) {
  return (
    <nav
      style={{
        position: "fixed",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 430,
        padding: "6px 26px 8px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 999,
          boxShadow:
            "0 10px 25px rgba(15,23,42,0.2), 0 0 0 1px rgba(148,163,184,0.18)",
          display: "flex",
          justifyContent: "space-around",
          padding: "8px 12px",
          fontSize: 12,
        }}
      >
        <button
          type="button"
          style={{
            border: "none",
            background: "transparent",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            color: "#2563EB",
            fontWeight: 700,
            cursor: "default",
          }}
        >
          <span>🏠</span>
          <span>홈</span>
        </button>
        <button
          type="button"
          onClick={onMyPageClick}
          style={{
            border: "none",
            background: "transparent",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            color: "#9CA3AF",
            cursor: "pointer",
          }}
        >
          <span>👤</span>
          <span>마이페이지</span>
        </button>
      </div>
    </nav>
  );
}
