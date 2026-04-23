"use client";

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CoursePlan, CourseStop, ScenarioObject, ScenarioType } from "@/lib/scenarioEngine/types";
import { logEvent } from "@/lib/logEvent";
import { logRecommendationCourse } from "@/lib/analytics/recommendationCourseLog";
import { getCourseCardExperimentGroup, type CourseCardExperimentGroup } from "@/lib/experiments/courseCardExperiment";
import { openDirections } from "@/lib/openDirections";

const PREVIEW_STOPS = 3;

type Props = {
  plans: CoursePlan[];
  /** 코스 도입 시나리오(로깅) */
  scenario: string;
  onPick?: (plan: CoursePlan) => void;
};

function placeTypeShort(t: CourseStop["placeType"]): string {
  const m: Record<string, string> = { FOOD: "식사", CAFE: "카페", ACTIVITY: "액티비티", WALK: "산책", CULTURE: "문화" };
  return m[t] ?? t;
}

function courseLabel(rank: number): string {
  return `${String.fromCharCode(65 + rank)}코스`;
}

export default function HomeCoursePreview({ plans, scenario, onPick }: Props) {
  const scenarioObj = useMemo(
    (): ScenarioObject => ({
      intentType: "course_generation",
      scenario: scenario as ScenarioType,
      rawQuery: "home_course_preview",
      confidence: 0.8,
    }),
    [scenario]
  );
  const [experimentGroup, setExperimentGroup] = useState<CourseCardExperimentGroup>("B");
  const experimentGroupRef = useRef<CourseCardExperimentGroup>("B");
  const impressed = useRef(new Set<string>());
  const detailLogged = useRef(new Set<string>());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const logBase = useCallback((courseId: string, cardRank: number) => {
    return {
      experiment_group: experimentGroupRef.current,
      scenario,
      course_id: courseId,
      card_rank: cardRank,
    };
  }, [scenario]);

  useLayoutEffect(() => {
    const g = getCourseCardExperimentGroup();
    experimentGroupRef.current = g;
    setExperimentGroup(g);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!plans.length || !containerRef.current) return;
    const root = containerRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || !(e.target instanceof HTMLElement)) continue;
          const id = e.target.dataset.courseId;
          const rankStr = e.target.dataset.cardRank;
          if (!id || rankStr == null) continue;
          if (impressed.current.has(id)) continue;
          impressed.current.add(id);
          const r = parseInt(rankStr, 10);
          logEvent("course_impression", logBase(id, r));
          const p = plans.find((pl) => pl.id === id);
          if (p) logRecommendationCourse("course_impression", p, scenarioObj, { rank_position: r, source_page: "home" });
        }
      },
      { threshold: 0.35, rootMargin: "0px" }
    );
    const cards = root.querySelectorAll("[data-course-card]");
    cards.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [plans, logBase, scenarioObj]);

  if (!plans.length) return null;

  const isB = experimentGroup === "B";
  const dev = process.env.NODE_ENV === "development";

  return (
    <div ref={containerRef} style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: "#374151" }}>코스 미리보기</div>
        {dev && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#1d4ed8",
              background: "#eff6ff",
              padding: "2px 8px",
              borderRadius: 999,
            }}
            title="?courseCardAB=A 또는 B 로 전환 가능"
          >
            실험 그룹: {experimentGroup}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plans.map((plan) => {
          const rank = plan.courseRank;
          const label = courseLabel(rank);
          const displayTitle = isB ? plan.situationTitle : plan.functionalTitle;
          const ctaLabel = isB ? "이 코스로 정하기" : "이 코스로 보기";
          const accentHue = [220, 160, 28][rank % 3]!;
          const borderTop = `3px solid hsla(${accentHue}, 55%, 52%, 0.55)`;

          const expanded = expandedId === plan.id;
          const previewLines = expanded ? plan.stops : plan.stops.slice(0, PREVIEW_STOPS);

          return (
            <div
              key={plan.id}
              data-course-card
              data-course-id={plan.id}
              data-card-rank={rank}
              role="button"
              tabIndex={0}
              onClick={() => {
                logEvent("course_click", logBase(plan.id, rank));
                logRecommendationCourse("course_click", plan, scenarioObj, {
                  rank_position: rank,
                  source_page: "home",
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  logEvent("course_click", logBase(plan.id, rank));
                  logRecommendationCourse("course_click", plan, scenarioObj, {
                    rank_position: rank,
                    source_page: "home",
                  });
                }
              }}
              style={{
                borderRadius: 16,
                padding: "12px 12px 10px",
                background: "#ffffff",
                boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
                border: "1px solid #e5e7eb",
                borderTop,
                cursor: "default",
                maxWidth: "100%",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#6b7280",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {label}
                </span>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>
                  약 {Math.round(plan.totalMinutes / 60)}시간{plan.totalMinutes % 60 ? ` ${plan.totalMinutes % 60}분` : ""}
                </span>
              </div>

              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: "#111827",
                  marginTop: 4,
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {plan.badges.map((b) => (
                    <span
                      key={b}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#1e3a5f",
                        background: "#e0f2fe",
                        padding: "3px 8px",
                        borderRadius: 999,
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}

              <div
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  marginTop: isB ? 8 : 6,
                  fontWeight: 600,
                }}
              >
                {plan.summaryLine}
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#4b5563",
                  lineHeight: 1.45,
                  marginTop: 6,
                  marginBottom: 8,
                }}
              >
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        logEvent("navigate_click", logBase(plan.id, rank));
                        openDirections({ name: s.placeName, lat: s.lat, lng: s.lng });
                      }
                    }}
                    style={{
                      cursor: "pointer",
                      textDecoration: "underline",
                      textDecorationColor: "rgba(75,85,99,0.35)",
                    }}
                  >
                    {s.startTime} · {placeTypeShort(s.placeType)} · {s.placeName}
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
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#2563eb",
                      cursor: "pointer",
                    }}
                  >
                    {expanded ? "접기" : `일정 더 보기 (${plan.stops.length}곳)`}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  logEvent("course_cta_click", logBase(plan.id, rank));
                  onPick?.(plan);
                }}
                style={{
                  width: "100%",
                  height: 38,
                  borderRadius: 12,
                  border: "none",
                  background: "#0f172a",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  letterSpacing: "-0.02em",
                }}
              >
                {ctaLabel}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
