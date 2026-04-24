"use client";

import React from "react";
import { colors, space, typo } from "@/lib/designTokens";
import { RECOMMEND_DECK_SIZE } from "@/lib/recommend/recommendConstants";

type Props = {
  /** 노출된 추천 장 수(로딩 중이면 생략) */
  resultCount?: number;
  isLoading?: boolean;
};

export function ResultsHeader({ resultCount, isLoading }: Props) {
  const loading = Boolean(isLoading);
  const n =
    resultCount != null ? Math.min(Math.max(0, resultCount), RECOMMEND_DECK_SIZE) : null;

  const title =
    loading || n == null
      ? "지금 상황에 맞춰 바로 정해볼게"
      : n === 0
        ? "지금은 바로 정해줄 후보가 없어"
        : "오늘의 결정 후보";

  const subtitle = loading
    ? "고민할 필요 없게, 핵심 1개와 보조 2개를 고르는 중…"
    : n === 0
      ? "조건은 알았어. 다른 말로 한 번만 더 말해줄래?"
      : "메인 추천 1개를 먼저 보고, 필요하면 보조 추천 2개에서 안전하게 고르면 돼";

  return (
    <header style={{ marginBottom: space.section }}>
      <h1
        style={{
          ...typo.sectionTitle,
          color: colors.textPrimary,
          margin: 0,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          ...typo.body,
          color: colors.textSecondary,
          margin: "8px 0 0",
        }}
      >
        {subtitle}
      </p>
    </header>
  );
}
