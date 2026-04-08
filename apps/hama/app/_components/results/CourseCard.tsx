"use client";

import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CoursePlan, CourseStop } from "@/lib/scenarioEngine/types";
import { logEvent } from "@/lib/logEvent";
import { getCourseCardExperimentGroup, type CourseCardExperimentGroup } from "@/lib/experiments/courseCardExperiment";
import { openDirections } from "@/lib/openDirections";
import { colors, radius, space } from "@/lib/designTokens";

const PREVIEW_STOPS = 3;

function placeTypeShort(t: CourseStop["placeType"]): string {
  const m: Record<string, string> = {
    FOOD: "식사",
    CAFE: "카페",
    ACTIVITY: "액티비티",
    WALK: "산책",
    CULTURE: "문화",
  };
  return m[t] ?? t;
}

function courseLabel(rank: number): string {
  return `${String.fromCharCode(65 + rank)}코스`;
}

type LogShape = Record<string, unknown>;

type Props = {
  plan: CoursePlan;
  logExtras: LogShape;
  onCta: (plan: CoursePlan) => void;
  onCardOpen: (plan: CoursePlan) => void;
};

export function CourseCard({ plan, logExtras, onCta, onCardOpen }: Props) {
  const [experimentGroup, setExperimentGroup] = useState<CourseCardExperimentGroup>("B");
  const experimentGroupRef = useRef<CourseCardExperimentGroup>("B");
  const impressed = useRef(false);
  const detailLogged = useRef(new Set<string>());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rank = plan.courseRank;
  const logBase = useCallback(
    (courseId: string, cardRank: number) => ({
      ...logExtras,
      experiment_group: experimentGroupRef.current,
      course_id: courseId,
      card_rank: cardRank,
    }),
    [logExtras]
  );

  useLayoutEffect(() => {
    const g = getCourseCardExperimentGroup();
    experimentGroupRef.current = g;
    setExperimentGroup(g);
  }, []);

  const cardRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (impressed.current || !cardRef.current) return;
    const el = cardRef.current;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting && !impressed.current) {
          impressed.current = true;
          logEvent("course_impression", logBase(plan.id, rank));
        }
      },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [plan.id, rank, logBase]);

  const isB = experimentGroup === "B";
  const displayTitle = isB ? plan.situationTitle : plan.functionalTitle;
  const ctaLabel = isB ? "이 코스로 정하기" : "이 코스로 보기";
  const accentHue = [220, 160, 28][rank % 3]!;
  const borderTop = `3px solid hsla(${accentHue}, 55%, 52%, 0.55)`;
  const expanded = expandedId === plan.id;
  const previewLines = expanded ? plan.stops : plan.stops.slice(0, PREVIEW_STOPS);
  const dev = process.env.NODE_ENV === "development";

  return (
    <div ref={cardRef} style={{ position: "relative" }}>
      {dev && (
        <div
          style={{
            position: "absolute",
            top: -4,
            right: 0,
            fontSize: 9,
            fontWeight: 700,
            color: colors.accentStrong,
            background: colors.accentSoft,
            padding: "2px 6px",
            borderRadius: radius.pill,
            zIndex: 1,
          }}
        >
          AB {experimentGroup}
        </div>
      )}
      <div
        data-course-card
        data-course-id={plan.id}
        data-card-rank={rank}
        role="button"
        tabIndex={0}
        onClick={() => {
          logEvent("course_click", logBase(plan.id, rank));
          onCardOpen(plan);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            logEvent("course_click", logBase(plan.id, rank));
            onCardOpen(plan);
          }
        }}
        style={{
          borderRadius: radius.largeCard,
          padding: space.pageX - 4,
          background: colors.bgCard,
          boxShadow: "0 10px 28px rgba(15,23,42,0.08)",
          border: `1px solid ${colors.borderSubtle}`,
          borderTop,
          minHeight: 220,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: colors.textSecondary }}>
            {courseLabel(rank)}
          </span>
          <span style={{ fontSize: 11, color: colors.textSecondary }}>
            약 {Math.round(plan.totalMinutes / 60)}시간
            {plan.totalMinutes % 60 ? ` ${plan.totalMinutes % 60}분` : ""}
          </span>
        </div>
        <div
          style={{
            fontSize: 17,
            fontWeight: 900,
            color: colors.textPrimary,
            marginTop: 6,
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}
        >
          {displayTitle}
        </div>
        {isB && plan.badges.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {plan.badges.map((b) => (
              <span
                key={b}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#1e3a5f",
                  background: "#e0f2fe",
                  padding: "4px 10px",
                  borderRadius: radius.pill,
                }}
              >
                {b}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, marginTop: 10 }}>
          {plan.summaryLine}
        </div>
        <div style={{ fontSize: 12, color: colors.textPrimary, lineHeight: 1.45, marginTop: 8 }}>
          {previewLines.map((s, i) => (
            <div
              key={`${s.placeId}-${i}`}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                logEvent("navigate_click", logBase(plan.id, rank));
                openDirections({ name: s.placeName, lat: s.lat, lng: s.lng });
              }}
              style={{ cursor: "pointer", textDecoration: "underline", textDecorationColor: "#cbd5e1" }}
            >
              {s.startTime} {s.placeName}
            </div>
          ))}
          {plan.stops.length > PREVIEW_STOPS && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const next = expanded ? null : plan.id;
                setExpandedId(next);
                if (!expanded && !detailLogged.current.has(plan.id)) {
                  detailLogged.current.add(plan.id);
                  logEvent("course_detail_view", logBase(plan.id, rank));
                }
              }}
              style={{
                marginTop: 6,
                border: "none",
                background: "none",
                padding: 0,
                fontSize: 12,
                fontWeight: 700,
                color: colors.accentPrimary,
                cursor: "pointer",
              }}
            >
              {expanded ? "접기" : `더 보기 (${plan.stops.length}곳)`}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            logEvent("course_cta_click", logBase(plan.id, rank));
            onCta(plan);
          }}
          style={{
            width: "100%",
            height: 46,
            marginTop: 14,
            borderRadius: radius.button,
            border: "none",
            background: colors.textPrimary,
            color: "#fff",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
