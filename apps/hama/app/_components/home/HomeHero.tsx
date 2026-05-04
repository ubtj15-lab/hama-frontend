"use client";

import React, { useState } from "react";
import { colors, typo } from "@/lib/designTokens";

type Props = {
  onSubmitQuery: (q: string) => void;
};

export function HomeHero({ onSubmitQuery }: Props) {
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const submit = () => {
    const t = query.trim();
    if (!t) return;
    onSubmitQuery(t);
    setQuery("");
  };

  return (
    <header style={{ marginBottom: 14, paddingTop: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: 0 }}>
        <div
          aria-hidden
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "#FF6B35",
            display: "grid",
            placeItems: "center",
            fontSize: 58,
            lineHeight: 1,
            boxShadow: "0 14px 28px rgba(255,107,53,0.26)",
            animation: "hamaFloat 3s ease-in-out infinite",
            marginBottom: 14,
          }}
        >
          🦛
        </div>
        <h1
          style={{
            ...typo.heroTitle,
            color: colors.textPrimary,
            margin: 0,
            lineHeight: 1.18,
            fontSize: 26,
            textAlign: "center",
            padding: "0 8px",
          }}
        >
          오늘{" "}
          <span
            style={{
              background: "linear-gradient(transparent 58%, #FFD4C2 58%)",
              padding: "0 2px",
            }}
          >
            뭐 할지
          </span>{" "}
          고민돼?
        </h1>
        <p
          style={{
            ...typo.body,
            margin: "10px 0 0",
            lineHeight: 1.45,
            fontWeight: 600,
            color: "#888",
            fontSize: 15,
            textAlign: "center",
            padding: "0 12px",
            maxWidth: 360,
          }}
        >
          하마가 상황에 맞게 골라줄게요
        </p>
      </div>

      <div
        style={{
          marginTop: 14,
          border: "1.5px solid #FFE0D0",
          borderRadius: 16,
          background: "#fff",
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: 54,
        }}
      >
        <span aria-hidden style={{ color: "#FF6B35", fontSize: 20, lineHeight: 1 }}>
          🔍
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="데이트, 가족 나들이, 혼자 시간 보내기, 실내 활동..."
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: 15,
            background: "transparent",
            color: colors.textPrimary,
          }}
        />
        <button
          type="button"
          onClick={() => {
            setToast("추천 받기는 검색창에 입력해 주세요");
            window.setTimeout(() => setToast(null), 1400);
          }}
          aria-label="추천 도우미"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "none",
            background: "#FF6B35",
            color: "#fff",
            cursor: "pointer",
            fontSize: 17,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          🪄
        </button>
      </div>
      {!!toast && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: colors.textSecondary,
            textAlign: "right",
            fontWeight: 700,
          }}
        >
          {toast}
        </p>
      )}
    </header>
  );
}
