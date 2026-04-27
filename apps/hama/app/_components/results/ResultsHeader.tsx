"use client";

import React from "react";
import { colors, space, typo } from "@/lib/designTokens";

type Props = {
  isLoading?: boolean;
  onOpenCriteria?: () => void;
};

export function ResultsHeader({ isLoading, onOpenCriteria }: Props) {
  const loading = Boolean(isLoading);

  return (
    <header style={{ marginBottom: space.section, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div>
        <h1
          style={{
            ...typo.sectionTitle,
            color: colors.textPrimary,
            margin: 0,
            letterSpacing: "-0.02em",
            fontWeight: 900,
          }}
        >
          오늘의 추천 🔥
        </h1>
        <p
          style={{
            ...typo.body,
            color: colors.textSecondary,
            margin: "8px 0 0",
          }}
        >
          {loading ? "지금 상황 기준으로 추천 정리 중이에요…" : "지금 상황 기준으로 가장 잘 맞는 곳을 골랐어요!"}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpenCriteria}
        style={{
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: 999,
          background: "#fff",
          color: colors.textPrimary,
          fontSize: 13,
          fontWeight: 800,
          padding: "9px 14px",
          whiteSpace: "nowrap",
          cursor: "pointer",
        }}
      >
        추천 기준 보기 ▾
      </button>
    </header>
  );
}
