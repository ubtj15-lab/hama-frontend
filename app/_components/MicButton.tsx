"use client";

import React from "react";

export default function MicButton({
  isListening,
  onClick,
}: {
  isListening: boolean;
  onClick: () => void;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 40 }}>
      <button
        type="button"
        onClick={onClick}
        aria-label="음성 검색 시작"
        style={{
          width: 92,
          height: 92,
          borderRadius: "50%",
          border: "6px solid rgba(255,255,255,0.6)",
          background: isListening ? "linear-gradient(135deg, #1d4ed8, #1e40af)" : "linear-gradient(135deg, #38bdf8, #2563eb)",
          boxShadow: "0 18px 40px rgba(37, 99, 235, 0.45), 0 0 0 4px rgba(191, 219, 254, 0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "background 0.18s ease, transform 0.1s ease, box-shadow 0.18s ease",
          transform: isListening ? "scale(1.06)" : "scale(1)",
        }}
      >
        <span style={{ fontSize: 32, color: "#ffffff" }}>🎙</span>
      </button>

      <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", lineHeight: 1.6 }}>
        “카페 찾아줘 / 식당 찾아줘 / 미용실 찾아줘” 처럼 말해보세요!
      </p>
    </section>
  );
}
