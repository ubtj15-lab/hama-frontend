"use client";

import React, { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import {
  readCoursePlanWithFallback,
  stashCoursePlan,
  encodeCoursePlanSnapshot,
} from "@/lib/session/courseSession";
import { logCourseDebug } from "@/lib/course/courseDebugLog";
import { logCourseStartClick } from "@/lib/analytics/courseEvents";
import { colors, radius, shadow, space } from "@/lib/designTokens";
import { openDirections } from "@/lib/openDirections";
import { recordPwaEngagement } from "@/lib/pwa/pwaEngagement";
import { logEvent } from "@/lib/logEvent";
import { analyticsFromScenario, mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { logRecommendationEvent } from "@/lib/analytics/logRecommendationEvent";
import { CoffeeIcon, RiceBowlIcon, SparkleIcon } from "@icons";
import { Skeleton } from "@ui/Skeleton";

function CourseDetailInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const courseSnapQ = sp.get("courseSnap")?.trim() ?? "";
  const [plan, setPlan] = useState<CoursePlan | null>(null);
  const [restoreAttempted, setRestoreAttempted] = useState(false);
  const [courseStartsCount, setCourseStartsCount] = useState<number | null>(null);
  const loggedImpression = useRef(false);

  useLayoutEffect(() => {
    if (!id) {
      setRestoreAttempted(true);
      return;
    }
    if (typeof window === "undefined") return;
    const h = window.location.hash;
    const hashSnap = h.startsWith("#hamaCourseSnap=")
      ? decodeURIComponent(h.slice("#hamaCourseSnap=".length))
      : undefined;
    const search = new URLSearchParams(window.location.search);
    const qSnap = search.get("courseSnap")?.trim() ?? undefined;
    const { plan: p } = readCoursePlanWithFallback(id, { courseSnapB64: qSnap, hashSnapB64: hashSnap });
    setPlan(p);
    setRestoreAttempted(true);
  }, [id, courseSnapQ]);

  useLayoutEffect(() => {
    if (plan?.id) {
      stashCoursePlan(plan);
    }
  }, [plan]);

  useEffect(() => {
    recordPwaEngagement();
  }, []);

  useEffect(() => {
    if (!plan?.id) return;
    if (loggedImpression.current) return;
    loggedImpression.current = true;
    logEvent("course_impression", mergeLogPayload({ scenario: plan.scenario }, { course_id: plan.id, page: "course_detail" }));
    logRecommendationEvent({
      event_name: "course_impression",
      entity_type: "course",
      entity_id: plan.id,
      scenario: plan.scenario,
      recommendation_rank: 1,
      source_page: "course_detail",
      course_snapshot: {
        id: plan.id,
        title: plan.situationTitle,
        stops: plan.stops.map((s) => ({ placeId: s.placeId, placeName: s.placeName, startTime: s.startTime })),
      },
    });
  }, [plan?.id, plan?.scenario]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const n = Number(json?.today?.card_views ?? 0);
        if (alive && Number.isFinite(n)) setCourseStartsCount(n);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!id) {
    return (
      <main style={{ padding: space.pageX }}>
        <p>코스 id가 없어.</p>
        <button type="button" onClick={() => router.push("/")} style={{ marginTop: 12 }}>
          홈으로
        </button>
      </main>
    );
  }

  if (!restoreAttempted) {
    return (
      <main style={{ padding: space.pageX }}>
        <Skeleton height={16} width="65%" />
        <Skeleton height={120} style={{ marginTop: 12 }} />
      </main>
    );
  }

  if (!plan) {
    return (
      <main style={{ padding: space.pageX }}>
        <p>코스 정보가 없어. 결과 화면에서 다시 선택해 줘.</p>
        <button type="button" onClick={() => router.push("/")} style={{ marginTop: 12 }}>
          홈으로
        </button>
      </main>
    );
  }

  const pseudo: ScenarioObject = {
    intentType: "course_generation",
    scenario: plan.scenario,
    rawQuery: plan.situationTitle,
  };
  const base = analyticsFromScenario(pseudo);

  const first = plan.stops[0];
  const weatherText = (() => {
    const h = new Date().getHours();
    if (h < 11) return "맑음 16°";
    if (h < 18) return "맑음 21°";
    return "선선함 18°";
  })();
  const stopReason = (placeType: string) => {
    if (placeType === "FOOD") return "지금 시간대에 가장 안정적으로 식사하기 좋아";
    if (placeType === "ACTIVITY") return "분위기 전환하기 좋은 활동 타이밍";
    if (placeType === "CAFE") return "동선 마무리로 쉬기 좋은 선택";
    return "이 흐름에서 자연스럽게 이어지는 장소";
  };
  const stopEmoji = (placeType: string) => {
    if (placeType === "FOOD") return <RiceBowlIcon size={14} color={colors.primaryDark} />;
    if (placeType === "ACTIVITY") return "🎯";
    if (placeType === "CAFE") return <CoffeeIcon size={14} color={colors.primaryDark} />;
    if (placeType === "WALK") return "🌿";
    return "📍";
  };

  const startCourse = () => {
    if (!first) return;
    logCourseDebug({
      event: "course_click_start",
      courseId: plan.id,
      stepIds: plan.stops.map((s) => s.placeId),
      extra: { ua: typeof navigator !== "undefined" ? navigator.userAgent : "" },
    });
    logCourseStartClick({
      courseId: plan.id,
      placeIds: plan.stops.map((s) => s.placeId),
      scenarioObject: pseudo,
      templateId: plan.templateId ?? null,
      stepPattern: plan.template.join(">"),
      recommendationRank: 1,
      courseSnapshot: {
        id: plan.id,
        title: plan.situationTitle,
        stops: plan.stops.map((s) => ({ placeId: s.placeId, placeName: s.placeName, startTime: s.startTime })),
      },
    });
    logEvent("course_start", mergeLogPayload(base, { course_id: plan.id, page: "course_detail" }));
    stashCoursePlan(plan);
    const snap = encodeCoursePlanSnapshot(plan);
    router.push(`/course/start-complete?id=${encodeURIComponent(plan.id)}&courseSnap=${encodeURIComponent(snap)}&placeName=${encodeURIComponent(first.placeName)}`);
  };

  return (
    <main style={{ maxWidth: 430, margin: "0 auto", padding: `16px ${space.pageX}px 40px`, background: colors.bgDefault }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button type="button" onClick={() => router.back()} style={{ border: "none", background: "none", color: colors.textPrimary, fontWeight: 900, cursor: "pointer", fontSize: 20 }}>
          ←
        </button>
        <strong style={{ fontSize: 18 }}>코스 상세</strong>
        <button
          type="button"
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.share) {
              void navigator.share({
                title: "코스 상세",
                text: plan.situationTitle,
                url: window.location.href,
              });
            }
          }}
          style={{ border: "none", background: "none", color: colors.textPrimary, fontWeight: 900, cursor: "pointer", fontSize: 16 }}
        >
          공유
        </button>
      </header>

      <span
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: colors.primaryDark,
          background: colors.primaryLight,
          borderRadius: 999,
          padding: "6px 11px",
          display: "inline-block",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <SparkleIcon size={12} color={colors.primaryDark} />
          추천 1순위 코스
        </span>
      </span>
      <h1 style={{ margin: "10px 0 0", fontSize: 28, letterSpacing: "-0.03em", lineHeight: 1.2 }}>{plan.situationTitle}</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {plan.badges.map((b) => (
          <span
            key={b}
            style={{
              fontSize: 12,
              fontWeight: 800,
              background: "#F7F7F4",
              color: colors.textSecondary,
              padding: "4px 10px",
              borderRadius: radius.pill,
            }}
          >
            {b}
          </span>
        ))}
      </div>

      <section
        style={{
          marginTop: 14,
          border: `1px solid ${colors.borderSubtle}`,
          background: "#fff",
          borderRadius: radius.card,
          boxShadow: shadow.soft,
          padding: 14,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 700 }}>총 소요</div>
          <div style={{ fontSize: 16, fontWeight: 900 }}>
            {Math.floor(plan.totalMinutes / 60)}시간{plan.totalMinutes % 60 ? ` ${plan.totalMinutes % 60}분` : ""}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 700 }}>오늘 날씨</div>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{weatherText}</div>
        </div>
        {courseStartsCount != null && courseStartsCount >= 5 ? (
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 700 }}>인기</div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>이 코스로 {courseStartsCount.toLocaleString()}명 출발</div>
          </div>
        ) : (
          <div style={{ gridColumn: "1 / -1", fontSize: 13, color: colors.textSecondary, fontWeight: 700 }}>
            오늘도 이 흐름으로 출발하는 사람들이 늘고 있어
          </div>
        )}
      </section>

      <h2 style={{ margin: "18px 0 10px", fontSize: 18, fontWeight: 900 }}>오늘의 일정</h2>
      <section style={{ position: "relative", paddingLeft: 18 }}>
        <div style={{ position: "absolute", left: 8, top: 10, bottom: 10, width: 2, background: "#F3E2D0" }} />
        {plan.stops.map((s, i) => {
          const next = plan.stops[i + 1];
          return (
            <div key={`${s.placeId}-${i}`} style={{ position: "relative", marginBottom: next ? 18 : 0 }}>
              <div style={{ position: "absolute", left: -14, top: 6, width: 14, height: 14, borderRadius: "50%", background: colors.primary }} />
              <div style={{ background: "#fff", border: `1px solid ${colors.borderSubtle}`, borderRadius: 14, padding: "10px 11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 800 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {stopEmoji(String(s.placeType))} {String(s.placeType)} / 체류 {s.dwellMinutes}분
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 800 }}>{s.startTime}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.02em" }}>{s.placeName}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3, fontWeight: 700 }}>
                  {stopReason(String(s.placeType))}
                </div>
              </div>
              {next && (
                <div style={{ margin: "8px 0 0 2px", fontSize: 12, color: colors.textSecondary, fontWeight: 700 }}>
                  🧭 차로 {s.travelMinutesToNext ?? 10}분 이동
                </div>
              )}
            </div>
          );
        })}
      </section>

      <div
        style={{
          position: "sticky",
          bottom: 12,
          marginTop: 20,
          background: "rgba(250,250,247,0.96)",
          backdropFilter: "blur(6px)",
          borderTop: `1px solid ${colors.borderSubtle}`,
          paddingTop: 10,
        }}
      >
        <button
          type="button"
          onClick={startCourse}
          style={{
            width: "100%",
            height: 50,
            borderRadius: radius.button,
            border: "none",
            background: "#111827",
            color: "#fff",
            fontWeight: 900,
            fontSize: 16,
            cursor: "pointer",
            boxShadow: shadow.cta,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <SparkleIcon size={14} color="#fff" />
            이 코스로 출발
          </span>
        </button>
        {first && (
          <button
            type="button"
            onClick={() => {
              logEvent("navigate_click", mergeLogPayload(base, { course_id: plan.id, stop: first.placeId }));
              openDirections({ name: first.placeName, lat: first.lat ?? null, lng: first.lng ?? null });
            }}
            style={{
              width: "100%",
              height: 46,
              marginTop: 8,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderSubtle}`,
              background: "#fff",
              color: colors.textPrimary,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🧭 첫 장소부터 길찾기
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            const q = (plan.sourceQuery ?? plan.situationTitle ?? "").trim();
            router.push(`/results?q=${encodeURIComponent(q)}`);
          }}
          style={{
            width: "100%",
            marginTop: 8,
            border: "none",
            background: "transparent",
            color: colors.textSecondary,
            fontSize: 14,
            fontWeight: 800,
            textDecoration: "underline",
            cursor: "pointer",
            padding: "6px 0",
          }}
        >
          다른 코스로 바꾸기
        </button>
      </div>
    </main>
  );
}

export default function CourseDetailPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24 }}>
          <Skeleton height={16} width="45%" />
          <Skeleton height={120} style={{ marginTop: 12 }} />
        </div>
      }
    >
      <CourseDetailInner />
    </Suspense>
  );
}
