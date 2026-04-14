"use client";

import React, { useState } from "react";
import { colors, radius, shadow, space } from "@/lib/designTokens";

/** 홈 — 빠른 시나리오 4개 이하 */
export const HOME_QUICK_SCENARIO_LIMIT = 4;

export const QUICK_SCENARIO_CANDIDATES: { label: string; query: string; icon: string }[] = [
  { label: "아이랑 나들이", query: "아이랑 나들이 갈 만한 곳 추천해줘", icon: "🧒" },
  { label: "데이트 코스", query: "데이트 코스로 좋은 곳 추천해줘", icon: "💕" },
  { label: "혼밥 추천", query: "혼자 밥 먹기 괜찮은 곳 추천", icon: "🍚" },
  { label: "부모님과 외식", query: "부모님이랑 조용히 식사하기 좋은 곳", icon: "🍽️" },
  { label: "카페 가기", query: "카페 추천", icon: "☕" },
  { label: "머리할 곳", query: "미용실 추천", icon: "✂️" },
  { label: "놀거리", query: "놀거리 추천", icon: "🎯" },
];

const HOME_ITEMS = QUICK_SCENARIO_CANDIDATES.slice(0, HOME_QUICK_SCENARIO_LIMIT);

type Props = { onPick: (query: string) => void };

export function QuickScenarioGrid({ onPick }: Props) {
  /** 탭하기 전에는 아무 칩도 ‘선택됨’으로 두지 않음 */
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div
      style={{
        marginBottom: space.section,
        marginRight: -space.pageX,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 6,
          paddingRight: space.pageX,
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        className="hama-chip-scroll"
      >
        <style>{`.hama-chip-scroll::-webkit-scrollbar{display:none}`}</style>
        {HOME_ITEMS.map((it) => {
          const on = selected === it.label;
          return (
            <button
              key={it.label}
              type="button"
              onClick={() => {
                setSelected(it.label);
                onPick(it.query);
              }}
              style={{
                flex: "0 0 auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 16px",
                borderRadius: radius.pill,
                border: on ? `1px solid ${colors.accentStrong}` : `1px solid ${colors.borderSubtle}`,
                background: on ? colors.accentSoft : colors.bgMuted,
                fontSize: 14,
                fontWeight: 700,
                color: on ? colors.accentStrong : colors.textSecondary,
                cursor: "pointer",
                boxShadow: on ? shadow.soft : "none",
                whiteSpace: "nowrap",
                boxSizing: "border-box",
                transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
              }}
            >
              <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
                {it.icon}
              </span>
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
