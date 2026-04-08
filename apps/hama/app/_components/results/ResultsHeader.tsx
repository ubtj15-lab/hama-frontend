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
      ? "지금 상황에 맞춰 골라볼게"
      : n === 0
        ? "곧 보여줄 수 있는 곳을 찾아볼게"
        : `고민 안 해도 되는 선택 ${n}개`;

  const subtitle = loading
    ? "조금만 기다려줘…"
    : n === 0
      ? "조건은 이해했어. 데이터가 맞으면 바로 카드가 뜰 거야."
      : "지금 상황에 딱 맞게 골랐어";

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
