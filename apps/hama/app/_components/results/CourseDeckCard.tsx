"use client";

import React, { useLayoutEffect, useRef } from "react";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import type { AnalyticsContext } from "@/lib/analytics/buildLogPayload";
import { mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import { logEvent } from "@/lib/logEvent";
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
  /** 결과 페이지 분석용 베이스(시나리오 등) — 노출 시 course_impression에 합쳐 전송 */
  logExtras?: AnalyticsContext;
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
  logExtras,
  onOpenCourse,
  onNavigateFirst,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const impressed = useRef(false);

  useLayoutEffect(() => {
    if (impressed.current || !cardRef.current) return;
    const el = cardRef.current;
    const base: AnalyticsContext = logExtras ?? { scenario: "generic" };
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting && !impressed.current) {
          impressed.current = true;
          logEvent(
            "course_impression",
            mergeLogPayload(base, {
              course_id: plan.id,
              card_rank: rank,
              source: "results_deck",
              template_id: plan.templateId ?? "beam",
              scenario: plan.scenario,
              step_categories: plan.template,
              place_ids: plan.stops.map((s) => s.placeId),
            })
          );
        }
      },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [plan.id, plan.scenario, plan.template, plan.templateId, plan.stops, rank, logExtras]);
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
      ref={cardRef}
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
        {plan.narrativeDescription && (
          <div style={{ ...typo.caption, color: colors.textSecondary, marginTop: 4, lineHeight: 1.35 }}>
            {plan.narrativeDescription}
          </div>
        )}
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
