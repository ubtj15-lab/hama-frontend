"use client";

import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import { encodeCoursePlanSnapshot, readCoursePlanWithFallback, stashCoursePlan } from "@/lib/session/courseSession";
import { colors, radius, shadow, space } from "@/lib/designTokens";
import { openDirections } from "@/lib/openDirections";
import { logRecommendationEvent } from "@/lib/analytics/logRecommendationEvent";
import { ChickIcon } from "@icons";
import { Skeleton } from "@ui/Skeleton";

function CourseStartCompleteInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get("id")?.trim() ?? "";
  const courseSnapQ = sp.get("courseSnap")?.trim() ?? "";
  const [plan, setPlan] = useState<CoursePlan | null>(null);
  const [ready, setReady] = useState(false);
  const loggedOnce = useRef(false);

  useLayoutEffect(() => {
    if (!id || typeof window === "undefined") {
      setReady(true);
      return;
    }
    const hash = window.location.hash;
    const hashSnap = hash.startsWith("#hamaCourseSnap=") ? decodeURIComponent(hash.slice("#hamaCourseSnap=".length)) : undefined;
    const search = new URLSearchParams(window.location.search);
    const qSnap = search.get("courseSnap")?.trim() ?? undefined;
    const { plan: p } = readCoursePlanWithFallback(id, { courseSnapB64: qSnap, hashSnapB64: hashSnap });
    setPlan(p);
    if (p) stashCoursePlan(p);
    setReady(true);
  }, [id, courseSnapQ]);

  const first = plan?.stops?.[0];
  const placeName = useMemo(() => sp.get("placeName")?.trim() || first?.placeName || "첫 장소", [sp, first?.placeName]);
  const firstType = String(first?.placeType ?? "SPOT");
  const firstTime = first?.startTime ?? "곧 출발";

  useEffect(() => {
    if (!ready || !plan || loggedOnce.current) return;
    loggedOnce.current = true;
    logRecommendationEvent({
      event_name: "course_start",
      entity_type: "course",
      entity_id: plan.id,
      scenario: plan.scenario,
      recommendation_rank: 1,
      source_page: "course_start_complete",
      course_snapshot: {
        id: plan.id,
        title: plan.situationTitle,
        stops: plan.stops.map((s) => ({ placeId: s.placeId, placeName: s.placeName, startTime: s.startTime })),
      },
      metadata: { trigger: "mount" },
    });
  }, [ready, plan]);

  if (!ready) {
    return (
      <main style={{ padding: space.pageX }}>
        <Skeleton height={16} width="55%" />
        <Skeleton height={100} style={{ marginTop: 12 }} />
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", padding: `18px ${space.pageX}px 34px`, background: colors.bgDefault }}>
      <section style={{ textAlign: "center", marginTop: 24 }}>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            margin: "0 auto",
            background: "#22C55E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 42,
            fontWeight: 900,
            boxShadow: "0 12px 24px rgba(34,197,94,0.28)",
          }}
        >
          ✓
        </div>
        <h1 style={{ margin: "14px 0 6px", fontSize: 30, lineHeight: 1.2, letterSpacing: "-0.04em" }}>좋아, 이 코스로 가자!</h1>
        <p style={{ margin: 0, color: colors.textSecondary, fontSize: 14, fontWeight: 700 }}>첫 장소부터 차례대로 안내할게</p>
      </section>

      <section style={{ marginTop: 18, borderRadius: radius.card, border: `1px solid ${colors.borderSubtle}`, background: "#fff", boxShadow: shadow.soft, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: colors.textMuted, marginBottom: 6 }}>첫 장소</div>
        <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 4 }}>{placeName}</div>
        <div style={{ fontSize: 13, color: colors.textSecondary, fontWeight: 700 }}>{firstTime}</div>
        <div style={{ marginTop: 8, display: "inline-flex", borderRadius: 999, padding: "5px 10px", background: "#F7F7F4", fontSize: 12, color: colors.textSecondary, fontWeight: 800 }}>
          {firstType}
        </div>
      </section>

      <section style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          onClick={() => {
            openDirections({ name: placeName, lat: first?.lat ?? null, lng: first?.lng ?? null });
          }}
          style={{
            width: "100%",
            height: 50,
            borderRadius: radius.button,
            border: "none",
            background: "#111827",
            color: "#fff",
            fontWeight: 900,
            fontSize: 15,
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(17,24,39,0.2)",
          }}
        >
          첫 장소 길찾기 →
        </button>
        <button
          type="button"
          onClick={() => {
            if (!plan) return;
            stashCoursePlan(plan);
            const snap = encodeCoursePlanSnapshot(plan);
            router.push(`/course/progress?id=${encodeURIComponent(plan.id)}&courseSnap=${encodeURIComponent(snap)}&placeName=${encodeURIComponent(placeName)}`);
          }}
          style={{
            width: "100%",
            height: 46,
            borderRadius: radius.button,
            border: `1px solid ${colors.borderSubtle}`,
            background: "#fff",
            color: colors.textPrimary,
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          코스 계속 보기
        </button>
      </section>

      <section style={{ marginTop: 14, borderRadius: radius.card, border: `1px solid ${colors.borderSubtle}`, background: "#FFF9F2", padding: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <ChickIcon size={16} color={colors.primaryDark} />
                    갔다 와서 한 번만 알려줘
                  </div>
      </section>

      <button
        type="button"
        onClick={() => router.push("/")}
        style={{
          width: "100%",
          marginTop: 16,
          border: "none",
          background: "transparent",
          color: colors.textSecondary,
          fontSize: 14,
          fontWeight: 800,
          textDecoration: "underline",
          cursor: "pointer",
          padding: "8px 0",
        }}
      >
        처음으로 돌아가기
      </button>
    </main>
  );
}

export default function CourseStartCompletePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24 }}>
          <Skeleton height={16} width="42%" />
          <Skeleton height={100} style={{ marginTop: 12 }} />
        </div>
      }
    >
      <CourseStartCompleteInner />
    </Suspense>
  );
}
