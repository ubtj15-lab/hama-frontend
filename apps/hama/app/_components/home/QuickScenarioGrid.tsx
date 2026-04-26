"use client";

import React, { useState } from "react";
import { colors, radius, shadow, space } from "@/lib/designTokens";
import { Touchable } from "@ui/Touchable";

export const QUICK_CATEGORY_CANDIDATES: {
  label: string;
  subtitle: string;
  query: string;
  icon: string;
  bg: string;
}[] = [
  { label: "푸드", subtitle: "식당 중심", query: "식당 추천해줘", icon: "🍴", bg: "#FFF3E7" },
  { label: "카페", subtitle: "커피·디저트·베이커리", query: "카페 추천해줘 디저트 베이커리", icon: "☕", bg: "#EEF6FF" },
  { label: "미용실", subtitle: "헤어·네일", query: "미용실 추천해줘", icon: "💇", bg: "#F3EFFF" },
  { label: "액티비티", subtitle: "체험·게임·전시", query: "액티비티 추천해줘 체험 게임 박물관", icon: "🎨", bg: "#EDFAF3" },
  { label: "코스", subtitle: "식당+카페+액티비티", query: "코스 추천해줘 식당 카페 액티비티", icon: "🗺️", bg: colors.category.course },
];

const HOME_GRID_ITEMS = QUICK_CATEGORY_CANDIDATES.slice(0, 4);
const HOME_COURSE_ITEM = QUICK_CATEGORY_CANDIDATES[4];

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
        {HOME_GRID_ITEMS.map((it) => {
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
                  <span aria-hidden style={{ display: "inline-flex", lineHeight: 1, fontSize: 21 }}>
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
      {HOME_COURSE_ITEM ? (
        <div style={{ marginTop: 12 }}>
          <Touchable>
            <button
              type="button"
              onClick={() => {
                setSelected(HOME_COURSE_ITEM.label);
                onPick(HOME_COURSE_ITEM.query);
              }}
              className="hama-press"
              style={{
                minHeight: 112,
                width: "100%",
                borderRadius: radius.card,
                border:
                  selected === HOME_COURSE_ITEM.label
                    ? `2px solid ${colors.accentPrimary}`
                    : `1px solid ${colors.borderSubtle}`,
                background: HOME_COURSE_ITEM.bg,
                color: colors.textPrimary,
                cursor: "pointer",
                boxShadow: selected === HOME_COURSE_ITEM.label ? shadow.card : "none",
                boxSizing: "border-box",
                textAlign: "left",
                padding: "15px 14px 13px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ display: "inline-flex", lineHeight: 1, fontSize: 21 }} aria-hidden>
                    {HOME_COURSE_ITEM.icon}
                  </span>
                  <strong style={{ fontSize: 19, letterSpacing: "-0.03em" }}>{HOME_COURSE_ITEM.label}</strong>
                  <span style={{ fontSize: 13, color: colors.textSecondary, fontWeight: 700 }}>
                    {HOME_COURSE_ITEM.subtitle}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: "0.01em",
                    color: colors.accentPrimary,
                    background: "rgba(255,255,255,0.9)",
                    borderRadius: 999,
                    padding: "6px 10px",
                  }}
                >
                  묶음 추천
                </span>
              </div>
            </button>
          </Touchable>
        </div>
      ) : null}
    </div>
  );
}
