"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import { readCoursePlanFromSession } from "@/lib/session/courseSession";
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
  const [plan, setPlan] = useState<CoursePlan | null>(null);

  useEffect(() => {
    if (!id) return;
    setPlan(readCoursePlanFromSession(id));
  }, [id]);

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
          logEvent("course_cta_click", mergeLogPayload(base, { course_id: plan.id, page: "course_detail" }));
          router.push("/");
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
