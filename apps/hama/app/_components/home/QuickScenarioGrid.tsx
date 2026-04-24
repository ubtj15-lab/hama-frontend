"use client";

import React, { useState } from "react";
import { colors, radius, shadow, space } from "@/lib/designTokens";

/** 홈 — 빠른 시나리오 4개 이하 */
export const HOME_QUICK_SCENARIO_LIMIT = 4;

export const QUICK_SCENARIO_CANDIDATES: {
  label: string;
  subtitle: string;
  query: string;
  icon: string;
  bg: string;
}[] = [
  { label: "아이랑", subtitle: "가족끼리 편하게", query: "아이랑 가족끼리 편하게 갈 만한 곳 추천해줘", icon: "👨‍👩‍👧", bg: "#FFF4E6" },
  { label: "데이트", subtitle: "둘만의 시간", query: "둘만의 데이트 장소 추천해줘", icon: "💕", bg: "#FFE8EC" },
  { label: "혼밥", subtitle: "나만의 한 끼", query: "혼자 밥 먹기 좋은 곳 추천해줘", icon: "🍚", bg: "#E8F4FF" },
  { label: "코스", subtitle: "하루를 통째로", query: "하루 코스로 갈 만한 일정 추천해줘", icon: "🎡", bg: "#EDF7ED" },
];

const HOME_ITEMS = QUICK_SCENARIO_CANDIDATES.slice(0, HOME_QUICK_SCENARIO_LIMIT);

type Props = { onPick: (query: string) => void };

export function QuickScenarioGrid({ onPick }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div
      style={{
        marginBottom: space.section,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
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
              className="hama-press"
              style={{
                minHeight: 106,
                borderRadius: radius.card,
                border: on ? `2px solid ${colors.accentPrimary}` : `1px solid ${colors.borderSubtle}`,
                background: it.bg,
                color: colors.textPrimary,
                cursor: "pointer",
                boxShadow: on ? shadow.card : "none",
                boxSizing: "border-box",
                transition: "transform 150ms ease, border-color 150ms ease",
                transform: on ? "scale(0.98)" : "scale(1)",
                textAlign: "left",
                padding: "14px 14px 12px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
                  {it.icon}
                </span>
                <strong style={{ fontSize: 18, letterSpacing: "-0.03em" }}>{it.label}</strong>
                <span style={{ fontSize: 13, color: colors.textSecondary, fontWeight: 700 }}>{it.subtitle}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
