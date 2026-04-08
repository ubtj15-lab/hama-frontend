"use client";

import React from "react";
import { colors, radius, space } from "@/lib/designTokens";

/** 홈 메인에서 노출하는 빠른 선택 상한 (결정형 UX — 3개 고정). */
export const HOME_QUICK_SCENARIO_LIMIT = 3;

/**
 * 전체 후보(실험·A/B용). 홈에서는 앞쪽 `HOME_QUICK_SCENARIO_LIMIT`개만 씀.
 * 추가 노출이 필요하면 플래그로 "더 보기" 등에서만 사용.
 */
export const QUICK_SCENARIO_CANDIDATES: { label: string; query: string }[] = [
  { label: "데이트 코스", query: "데이트 코스 짜줘" },
  { label: "아이랑 나들이", query: "아이랑 나들이" },
  { label: "혼밥 추천", query: "혼밥 추천" },
  { label: "카페 가기", query: "카페 추천" },
  { label: "머리할 곳", query: "미용실 추천" },
  { label: "놀거리", query: "놀거리 추천" },
];

const HOME_ITEMS = QUICK_SCENARIO_CANDIDATES.slice(0, HOME_QUICK_SCENARIO_LIMIT);

type Props = { onPick: (query: string) => void };

export function QuickScenarioGrid({ onPick }: Props) {
  return (
    <div style={{ marginBottom: space.section }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: space.chip,
        }}
      >
        {HOME_ITEMS.map((it) => (
          <button
            key={it.label}
            type="button"
            onClick={() => onPick(it.query)}
            style={{
              textAlign: "left",
              padding: "16px 18px",
              borderRadius: radius.card,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgCard,
              fontSize: 15,
              fontWeight: 800,
              color: colors.textPrimary,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
            }}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}
