"use client";

import React, { useLayoutEffect, useRef } from "react";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import type { AnalyticsContext } from "@/lib/analytics/buildLogPayload";
import { mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import { logEvent } from "@/lib/logEvent";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { logRecommendationCourse } from "@/lib/analytics/recommendationCourseLog";
import { Chip } from "@/_components/common/Chip";
import { Thumbnail } from "@/_components/common/Thumbnail";
import { colors, radius, space, typo } from "@/lib/designTokens";
import { getDefaultCardImage } from "@/lib/defaultCardImage";
import type { HomeCard } from "@/lib/storeTypes";
import { courseFirstStopSuggestsReservation, getReservationPreviewForStore } from "@/lib/reservation/bookingDummy";

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
 * 코스 덱 카드 — 1단계 예약 가능 여부·슬롯 요약 + 예약/코스-only CTA.
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
  const fs = plan.stops[0];
  const reserveFirstHint =
    fs && courseFirstStopSuggestsReservation(fs.placeType, String(fs.servingType ?? "meal"));
  const slotPreview = fs ? getReservationPreviewForStore(fs.placeId, fs.dbCategory ?? null) : null;

  return (
    <div
      ref={cardRef}
      style={{
        display: "flex",
        gap: 12,
        padding: 12,
        minHeight: 132,
        borderRadius: radius.card,
        background: colors.bgCard,
        border: `1px solid ${colors.borderSubtle}`,
        boxShadow: "0 6px 20px rgba(15,23,42,0.06)",
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
        {reserveFirstHint && slotPreview && (
          <div style={{ ...typo.caption, color: colors.accentStrong, marginTop: 6, fontWeight: 800, lineHeight: 1.35 }}>
            1단계 예약 가능 · 오늘 {slotPreview.slotLabels.slice(0, 3).join(" / ")}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", paddingTop: 10 }}>
          {reserveFirstHint && onReserveAndStart ? (
            <>
              <div style={{ display: "flex", gap: space.chip }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    logRecommendationCourse("course_click", plan, scenarioObject, {
                      rank_position: rank,
                      source_page: "results_deck",
                      metadata: { cta: "reserve_start" },
                    });
                    onReserveAndStart();
                  }}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: radius.button,
                    border: "none",
                    background: colors.accentPrimary,
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  이 코스 예약하고 시작하기
                </button>
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
                    flex: 1,
                    height: 44,
                    borderRadius: radius.button,
                    border: `1px solid ${colors.borderStrong}`,
                    background: colors.bgCard,
                    color: colors.textPrimary,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  코스만 보기
                </button>
              </div>
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
                  width: "100%",
                  height: 40,
                  borderRadius: radius.button,
                  border: `1px solid ${colors.borderSubtle}`,
                  background: colors.bgMuted,
                  color: colors.textSecondary,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                첫 장소 길찾기
              </button>
            </>
          ) : (
            <div style={{ display: "flex", gap: space.chip }}>
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
                코스만 보기
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
          )}
        </div>
      </div>
      <span style={{ ...typo.caption, color: colors.textSecondary, alignSelf: "flex-start" }}>#{rank + 1}</span>
    </div>
  );
}
