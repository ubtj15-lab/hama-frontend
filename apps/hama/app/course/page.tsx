"use client";

import React, { Suspense, useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import {
  readCoursePlanWithFallback,
  stashCoursePlan,
  encodeCoursePlanSnapshot,
} from "@/lib/session/courseSession";
import { logCourseDebug } from "@/lib/course/courseDebugLog";
import { logCourseStartClick } from "@/lib/analytics/courseEvents";
import { colors, radius, space, typo } from "@/lib/designTokens";
import { CourseTimeline } from "@/_components/detail/CourseTimeline";
import { openDirections } from "@/lib/openDirections";
import { logEvent } from "@/lib/logEvent";
import { analyticsFromScenario, mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";

function CourseDetailInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const courseSnapQ = sp.get("courseSnap")?.trim() ?? "";
  const [plan, setPlan] = useState<CoursePlan | null>(null);
  const [restoreAttempted, setRestoreAttempted] = useState(false);

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
        <p>코스 불러오는 중…</p>
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

  return (
    <main style={{ maxWidth: 430, margin: "0 auto", padding: `16px ${space.pageX}px 40px`, background: colors.bgDefault }}>
      <button
        type="button"
        onClick={() => router.back()}
        style={{ border: "none", background: "none", color: colors.accentPrimary, fontWeight: 800, cursor: "pointer" }}
      >
        ← 뒤로
      </button>
      <h1 style={{ ...typo.sectionTitle, marginTop: 12 }}>{plan.situationTitle}</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {plan.badges.map((b) => (
          <span
            key={b}
            style={{
              fontSize: 12,
              fontWeight: 700,
              background: colors.accentSoft,
              color: colors.accentStrong,
              padding: "4px 10px",
              borderRadius: radius.pill,
            }}
          >
            {b}
          </span>
        ))}
      </div>
      <p style={{ ...typo.body, color: colors.textSecondary, marginTop: 12 }}>
        총 약 {Math.round(plan.totalMinutes / 60)}시간{" "}
        {plan.totalMinutes % 60 ? `${plan.totalMinutes % 60}분` : ""}
      </p>
      <h2 style={{ ...typo.cardTitle, marginTop: 24 }}>일정</h2>
      <CourseTimeline stops={plan.stops} />
      <button
        type="button"
        onClick={() => {
          logCourseDebug({
            event: "course_click_start",
            courseId: plan.id,
            stepIds: plan.stops.map((s) => s.placeId),
            extra: { ua: typeof navigator !== "undefined" ? navigator.userAgent : "" },
          });
          logCourseStartClick({
            courseId: plan.id,
            placeIds: plan.stops.map((s) => s.placeId),
          });
          logEvent("course_cta_click", mergeLogPayload(base, { course_id: plan.id, page: "course_detail" }));
          stashCoursePlan(plan);
          const snap = encodeCoursePlanSnapshot(plan);
          const q = (plan.sourceQuery ?? plan.situationTitle ?? "").trim();
          const cid = encodeURIComponent(plan.id);
          const maxQuerySnap = 4500;
          const useHashOnly = snap.length > maxQuerySnap;
          const snapQuery = !useHashOnly ? `&courseSnap=${encodeURIComponent(snap)}` : "";
          const hashPart = useHashOnly ? `#hamaCourseSnap=${encodeURIComponent(snap)}` : "";
          const qPart = q ? `q=${encodeURIComponent(q)}&` : "";
          router.push(`/results?${qPart}courseId=${cid}${snapQuery}${hashPart}`);
        }}
        style={{
          width: "100%",
          height: 50,
          marginTop: 20,
          borderRadius: radius.button,
          border: "none",
          background: colors.accentPrimary,
          color: "#fff",
          fontWeight: 800,
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        이 코스로 출발
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
            height: 50,
            marginTop: 10,
            borderRadius: radius.button,
            border: `1px solid ${colors.borderSubtle}`,
            background: colors.bgCard,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          첫 장소 길찾기
        </button>
      )}
    </main>
  );
}

export default function CourseDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>로딩…</div>}>
      <CourseDetailInner />
    </Suspense>
  );
}
