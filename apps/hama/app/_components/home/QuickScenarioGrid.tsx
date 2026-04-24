"use client";

import React, { useState } from "react";
import { colors, radius, shadow, space } from "@/lib/designTokens";
import { FamilyIcon, FerrisWheelIcon, HeartIcon, RiceBowlIcon } from "@icons";
import { Touchable } from "@ui/Touchable";

/** 홈 — 빠른 시나리오 4개 이하 */
export const HOME_QUICK_SCENARIO_LIMIT = 4;

export const QUICK_SCENARIO_CANDIDATES: {
  label: string;
  subtitle: string;
  query: string;
  icon: React.ReactNode;
  bg: string;
}[] = [
  { label: "아이랑", subtitle: "가족끼리 편하게", query: "아이랑 가족끼리 편하게 갈 만한 곳 추천해줘", icon: <FamilyIcon size={20} color={colors.primaryDark} />, bg: colors.category.family },
  { label: "데이트", subtitle: "둘만의 시간", query: "둘만의 데이트 장소 추천해줘", icon: <HeartIcon size={20} color={colors.primaryDark} />, bg: colors.category.date },
  { label: "혼밥", subtitle: "나만의 한 끼", query: "혼자 밥 먹기 좋은 곳 추천해줘", icon: <RiceBowlIcon size={20} color={colors.primaryDark} />, bg: colors.category.solo },
  { label: "코스", subtitle: "하루를 통째로", query: "하루 코스로 갈 만한 일정 추천해줘", icon: <FerrisWheelIcon size={20} color={colors.primaryDark} />, bg: colors.category.course },
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
            <Touchable key={it.label}>
              <button
                type="button"
                onClick={() => {
                  setSelected(it.label);
                  onPick(it.query);
                }}
                className="hama-press"
                style={{
                  minHeight: 106,
                  width: "100%",
                  borderRadius: radius.card,
                  border: on ? `2px solid ${colors.accentPrimary}` : `1px solid ${colors.borderSubtle}`,
                  background: it.bg,
                  color: colors.textPrimary,
                  cursor: "pointer",
                  boxShadow: on ? shadow.card : "none",
                  boxSizing: "border-box",
                  transition: "border-color 150ms ease",
                  textAlign: "left",
                  padding: "14px 14px 12px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span aria-hidden style={{ display: "inline-flex", lineHeight: 1 }}>
                    {it.icon}
                  </span>
                  <strong style={{ fontSize: 18, letterSpacing: "-0.03em" }}>{it.label}</strong>
                  <span style={{ fontSize: 13, color: colors.textSecondary, fontWeight: 700 }}>{it.subtitle}</span>
                </div>
              </button>
            </Touchable>
          );
        })}
      </div>
    </div>
  );
}
