"use client";

import React, { useState } from "react";
import { colors, space, typo } from "@/lib/designTokens";

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
    <header style={{ marginBottom: space.sectionTight, paddingTop: 4 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: 130 }}>
        <div
          aria-hidden
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "#FF6B35",
            display: "grid",
            placeItems: "center",
            fontSize: 40,
            boxShadow: "0 12px 24px rgba(255,107,53,0.25)",
            animation: "hamaFloat 3s ease-in-out infinite",
            marginBottom: 10,
          }}
        >
          🦛
        </div>
        <h1
          style={{
            ...typo.heroTitle,
            color: colors.textPrimary,
            margin: 0,
            lineHeight: 1.22,
            fontSize: 22,
            textAlign: "center",
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
            margin: "8px 0 0",
            lineHeight: 1.5,
            fontWeight: 600,
            color: "#888",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          하마가 딱 골라줄게요
        </p>
      </div>

      <div
        style={{
          marginTop: 14,
          border: "1.5px solid #FFE0D0",
          borderRadius: 18,
          background: "#fff",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: 60,
        }}
      >
        <span aria-hidden style={{ color: "#FF6B35", fontSize: 18, lineHeight: 1 }}>
          🔍
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="회식할 곳, 데이트, 가족 외식..."
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: 14,
            background: "transparent",
            color: colors.textPrimary,
          }}
        />
        <button
          type="button"
          onClick={() => {
            setToast("마이크 기능은 준비 중이에요");
            window.setTimeout(() => setToast(null), 1200);
          }}
          aria-label="마이크 준비 중"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            background: "#FF6B35",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          🎤
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
      <p
        style={{
          margin: "12px 0 0",
          textAlign: "center",
          fontSize: 12,
          color: "#aaa",
          fontWeight: 700,
          letterSpacing: "0.01em",
        }}
      >
        또는 카테고리에서 골라보세요
      </p>
    </header>
  );
}
