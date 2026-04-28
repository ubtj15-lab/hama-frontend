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
  { label: "미용실", subtitle: "헤어·네일·속눈썹·제모", query: "미용실 추천해줘", icon: "💇", bg: "#F3EFFF" },
  { label: "액티비티", subtitle: "체험·게임·전시", query: "액티비티 추천해줘 체험 게임 박물관", icon: "🎨", bg: "#EDFAF3" },
  { label: "코스", subtitle: "식당+카페+액티비티", query: "코스 추천해줘 식당 카페 액티비티", icon: "🗺️", bg: colors.category.course },
];

const HOME_GRID_ITEMS = QUICK_CATEGORY_CANDIDATES.slice(0, 4);
const HOME_COURSE_ITEM = QUICK_CATEGORY_CANDIDATES[4];

type Props = { onPick: (query: string) => void };

export function QuickScenarioGrid({ onPick }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [beautyExpanded, setBeautyExpanded] = useState(false);
  const [beautySubCategory, setBeautySubCategory] = useState<"hair" | "nail" | "eyelash" | "waxing" | null>(null);

  const beautyQueryMap: Record<"hair" | "nail" | "eyelash" | "waxing", string> = {
    hair: "미용실 추천해줘 헤어 커트 펌 염색",
    nail: "미용실 추천해줘 네일 네일아트",
    eyelash: "미용실 추천해줘 속눈썹 래쉬",
    waxing: "미용실 추천해줘 제모 왁싱",
  };

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
                  if (it.label === "미용실") {
                    setBeautyExpanded(true);
                    return;
                  }
                  setBeautyExpanded(false);
                  setBeautySubCategory(null);
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
      {beautyExpanded ? (
        <div
          style={{
            marginTop: 12,
            borderRadius: radius.card,
            border: `1px solid ${colors.borderSubtle}`,
            background: "#fff",
            padding: "12px 12px 10px",
          }}
        >
          <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 900, color: colors.textPrimary }}>
            어떤 관리를 찾고 있어요?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { id: "hair", label: "헤어" },
              { id: "nail", label: "네일" },
              { id: "eyelash", label: "속눈썹" },
              { id: "waxing", label: "제모" },
            ].map((opt) => {
              const active = beautySubCategory === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    const next = opt.id as "hair" | "nail" | "eyelash" | "waxing";
                    setBeautySubCategory(next);
                    onPick(beautyQueryMap[next]);
                  }}
                  style={{
                    height: 42,
                    borderRadius: radius.button,
                    border: active ? `2px solid ${colors.accentPrimary}` : `1px solid ${colors.borderSubtle}`,
                    background: active ? colors.primaryLight : "#fff",
                    color: colors.textPrimary,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
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
