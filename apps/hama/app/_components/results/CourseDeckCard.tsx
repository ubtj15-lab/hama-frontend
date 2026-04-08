"use client";

import React from "react";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import { Chip } from "@/_components/common/Chip";
import { Thumbnail } from "@/_components/common/Thumbnail";
import { colors, radius, space, typo } from "@/lib/designTokens";
import { getDefaultCardImage } from "@/lib/defaultCardImage";
import type { HomeCard } from "@/lib/storeTypes";

type Props = {
  plan: CoursePlan;
  rank: number;
  thumbCard: HomeCard | null;
  badges: string[];
  onOpenCourse: () => void;
  onNavigateFirst: () => void;
};

/**
 * RecommendationCard와 동일한 행 레이아웃(썸네일 + 본문 + 하단 2버튼)으로 코스 안을 요약 표시.
 */
export function CourseDeckCard({
  plan,
  rank,
  thumbCard,
  badges,
  onOpenCourse,
  onNavigateFirst,
}: Props) {
  const fallbackCard: HomeCard = {
    id: plan.stops[0]?.placeId ?? "course",
    name: plan.stops[0]?.placeName ?? "코스",
    category:
      plan.stops[0]?.placeType === "CAFE"
        ? "cafe"
        : plan.stops[0]?.placeType === "ACTIVITY"
          ? "activity"
          : "restaurant",
  } as HomeCard;
  const thumb =
    (thumbCard && ((thumbCard as any).imageUrl ?? (thumbCard as any).image_url)) ||
    getDefaultCardImage(thumbCard ?? fallbackCard);
  const preview = plan.stops.slice(0, 3);
  const flowLine = preview.map((s) => `${s.placeName}`).join(" → ");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenCourse}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenCourse();
        }
      }}
      style={{
        display: "flex",
        gap: 12,
        padding: 12,
        minHeight: 132,
        borderRadius: radius.card,
        background: colors.bgCard,
        border: `1px solid ${colors.borderSubtle}`,
        boxShadow: "0 6px 20px rgba(15,23,42,0.06)",
        cursor: "pointer",
      }}
    >
      <Thumbnail src={thumb} alt="" size={84} radius={14} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ ...typo.cardTitle, fontSize: 16, color: colors.textPrimary, lineHeight: 1.25 }}>
          {plan.functionalTitle || plan.situationTitle}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          <Chip>코스 · {plan.stops.length}곳</Chip>
          {badges.slice(0, 3).map((b) => (
            <span
              key={b}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.textSecondary,
                background: colors.bgMuted,
                padding: "3px 8px",
                borderRadius: radius.pill,
              }}
            >
              {b}
            </span>
          ))}
        </div>
        {flowLine && (
          <div style={{ ...typo.caption, color: colors.textSecondary, marginTop: 8, lineHeight: 1.4 }}>
            {flowLine}
          </div>
        )}
        <div style={{ display: "flex", gap: space.chip, marginTop: "auto", paddingTop: 10 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenCourse();
            }}
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.button,
              border: "none",
              background: colors.accentPrimary,
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            이 코스로 보기
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigateFirst();
            }}
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgCard,
              color: colors.textPrimary,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            길찾기
          </button>
        </div>
      </div>
      <span style={{ ...typo.caption, color: colors.textSecondary, alignSelf: "flex-start" }}>#{rank + 1}</span>
    </div>
  );
}
