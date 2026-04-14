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
      ? "상황에 맞춰 골라볼게"
      : n === 0
        ? "지금은 보여줄 카드가 없어"
        : `오늘의 결정 ${n}개`;

  const subtitle = loading
    ? "잠만, 골라오는 중…"
    : n === 0
      ? "조건은 알았어. 다른 말로 한 번만 더 말해줄래?"
      : "왜 이 곳인지 카드에 적어뒀어. 마음에 들면 바로 가면 돼";

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
