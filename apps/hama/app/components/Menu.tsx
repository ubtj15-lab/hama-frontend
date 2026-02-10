// app/components/Menu.tsx
"use client";

import React from "react";

type MenuProps = {
  onClose?: () => void;
};

export default function Menu({ onClose }: MenuProps) {
  return (
    <div
      style={{
        position: "fixed",
        top: 70,
        left: 16,
        width: 220,
        borderRadius: 20,
        background: "#ffffff",
        boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
        padding: 16,
        zIndex: 1600,
        fontSize: 13,
      }}
    >
      <div
        style={{
          marginBottom: 12,
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        하마 메뉴
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid #E5E7EB",
          background: "#f9fafb",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        닫기
      </button>
    </div>
  );
}
