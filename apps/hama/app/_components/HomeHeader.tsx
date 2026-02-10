"use client";

import React from "react";

export default function HomeHeader({
  menuButtonRef,
  onMenuClick,
}: {
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
  onMenuClick: () => void;
}) {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onMenuClick}
        aria-label="메뉴 열기"
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          border: "none",
          background: "#ffffff",
          boxShadow: "0 4px 12px rgba(15,23,42,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <div style={{ width: 18, height: 2, borderRadius: 999, background: "#111827", boxShadow: "0 6px 0 #111827, 0 -6px 0 #111827" }} />
      </button>

      <div style={{ flex: 1, textAlign: "center", fontWeight: 800, letterSpacing: 3, fontSize: 20, color: "#2563EB" }}>
        HAMA
      </div>

      <div style={{ width: 40, height: 40 }} />
    </header>
  );
}
