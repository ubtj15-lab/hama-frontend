"use client";

import React, { useLayoutEffect, useRef } from "react";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import type { AnalyticsContext } from "@/lib/analytics/buildLogPayload";
import { mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import { logEvent } from "@/lib/logEvent";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { logRecommendationCourse } from "@/lib/analytics/recommendationCourseLog";
import { Chip } from "@/_components/common/Chip";
import { categoryTokens, colors, radius, shadow, space, typo } from "@/lib/designTokens";
import type { HomeCard } from "@/lib/storeTypes";
import { CoffeeIcon, RiceBowlIcon, SparkleIcon } from "@icons";
import { Touchable } from "@ui/Touchable";

type Props = {
  plan: CoursePlan;
  rank: number;
  thumbCard: HomeCard | null;
  badges: string[];
  logExtras?: AnalyticsContext;
  /** `recommendation_events` 풀 키용 */
  scenarioObject?: ScenarioObject | null;
  /** 첫 단계 식당 예약 유도 시 */
  onReserveAndStart?: () => void;
  /** 코스 상세만 (실행 일정 보기) */
  onViewCourseOnly: () => void;
  onNavigateFirst: () => void;
};

/**
 * 코스 덱 카드 — 시안 6 기준 코스 리스트 카드.
 */
export function CourseDeckCard({
  plan,
  rank,
  thumbCard,
  badges,
  logExtras,
  scenarioObject = null,
  onReserveAndStart,
  onViewCourseOnly,
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
          logRecommendationCourse("course_impression", plan, scenarioObject, {
            rank_position: rank,
            source_page: "results_deck",
          });
        }
      },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [plan.id, plan.scenario, plan.template, plan.templateId, plan.stops, rank, logExtras, scenarioObject]);

  const preview = plan.stops.slice(0, 3);
  const rankOne = rank === 0;
  const totalHour = `${Math.floor(plan.totalMinutes / 60)}시간${plan.totalMinutes % 60 ? ` ${plan.totalMinutes % 60}분` : ""}`;
  const typeLabel = (t: string) =>
    t === "FOOD" ? "식당" : t === "ACTIVITY" ? "활동" : t === "CAFE" ? "카페" : t === "WALK" ? "산책" : "코스";
  const typeEmoji = (t: string) => (t === "FOOD" ? <RiceBowlIcon size={14} color={colors.primaryDark} /> : t === "CAFE" ? <CoffeeIcon size={14} color={colors.primaryDark} /> : t === "ACTIVITY" ? "🎯" : t === "WALK" ? "🌿" : "📍");

  return (
    <Touchable>
      <div
        ref={cardRef}
        style={{
          padding: 14,
          minHeight: 132,
          borderRadius: radius.card,
          background: colors.bgCard,
          border: rankOne ? `2px solid ${colors.primary}` : `1px solid ${colors.borderSubtle}`,
          boxShadow: rankOne ? "0 4px 20px rgba(255,107,53,0.08)" : "0 2px 10px rgba(17,24,39,0.05)",
        }}
      >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: rankOne ? colors.primaryDark : colors.textSecondary,
            background: rankOne ? colors.primaryLight : "#F9FAFB",
            borderRadius: radius.pill,
            padding: "5px 10px",
          }}
        >
          {rankOne ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <SparkleIcon size={12} color={colors.primaryDark} />
              추천 1순위
            </span>
          ) : (
            `#${rank + 1}`
          )}
        </span>
        <span style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 800 }}>총 {totalHour}</span>
      </div>

      <div style={{ ...typo.cardTitle, fontSize: 20, color: colors.textPrimary, lineHeight: 1.25 }}>
        {plan.situationTitle || plan.functionalTitle}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {badges.slice(0, 3).map((b) => (
          <Chip key={b}>{b}</Chip>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {preview.map((s, i) => {
          const tone =
            s.placeType === "FOOD"
              ? categoryTokens.FOOD
              : s.placeType === "ACTIVITY"
                ? categoryTokens.ACTIVITY
                : s.placeType === "CAFE"
                  ? categoryTokens.CAFE
                  : categoryTokens.PARK;
          return (
            <React.Fragment key={`${s.placeId}-${i}-flow`}>
              <div
                style={{
                  minWidth: 88,
                  borderRadius: 12,
                  border: `1px solid ${tone.ring}`,
                  background: tone.bg,
                  padding: "8px 9px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{typeEmoji(String(s.placeType))}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: colors.textSecondary }}>{typeLabel(String(s.placeType))}</span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: colors.textPrimary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.placeName}
                </div>
                <div style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 700, marginTop: 2 }}>{s.startTime}</div>
              </div>
              {i < preview.length - 1 && <span style={{ color: colors.textMuted, fontWeight: 900 }}>→</span>}
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: space.chip, marginTop: 12 }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            logRecommendationCourse("course_click", plan, scenarioObject, {
              rank_position: rank,
              source_page: "results_deck",
              metadata: { cta: "view_only" },
            });
            onViewCourseOnly();
          }}
          style={{
            flex: 1.6,
            height: 44,
            borderRadius: radius.button,
            border: "none",
            background: colors.textPrimary,
            color: "#fff",
            fontWeight: 900,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: shadow.cta,
          }}
        >
          이 코스로 보기
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            logRecommendationCourse("course_click", plan, scenarioObject, {
              rank_position: rank,
              source_page: "results_deck",
              metadata: { cta: "directions_first" },
            });
            onNavigateFirst();
          }}
          style={{
            flex: 1,
            height: 44,
            borderRadius: radius.button,
            border: `1px solid ${colors.borderSubtle}`,
            background: "#fff",
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
    </Touchable>
  );
}
