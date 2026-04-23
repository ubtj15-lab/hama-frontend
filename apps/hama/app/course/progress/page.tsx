"use client";

import React, { Suspense, useLayoutEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import {
  readCoursePlanWithFallback,
  stashCoursePlan,
  readCourseRunRecord,
  advanceCourseToNextStop,
} from "@/lib/session/courseSession";
import { colors, radius, shadow, space, typo } from "@/lib/designTokens";
import { openDirections } from "@/lib/openDirections";
import { logEvent } from "@/lib/logEvent";

function CourseProgressInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get("id")?.trim() ?? "";
  const courseSnapQ = sp.get("courseSnap")?.trim() ?? "";
  const [plan, setPlan] = useState<CoursePlan | null>(null);
  const [ready, setReady] = useState(false);
  const [runTick, setRunTick] = useState(0);

  useLayoutEffect(() => {
    if (!id || typeof window === "undefined") {
      setReady(true);
      return;
    }
    const h = window.location.hash;
    const hashSnap = h.startsWith("#hamaCourseSnap=")
      ? decodeURIComponent(h.slice("#hamaCourseSnap=".length))
      : undefined;
    const search = new URLSearchParams(window.location.search);
    const qSnap = search.get("courseSnap")?.trim() ?? undefined;
    const { plan: p } = readCoursePlanWithFallback(id, { courseSnapB64: qSnap, hashSnapB64: hashSnap });
    setPlan(p);
    if (p) stashCoursePlan(p);
    setReady(true);
  }, [id, courseSnapQ]);

  const bump = () => setRunTick((v) => v + 1);
  const run = useMemo(() => readCourseRunRecord(id), [id, runTick]);

  if (!id) {
    return (
      <main style={{ padding: space.pageX }}>
        <p>코스 id가 없어요.</p>
      </main>
    );
  }

  if (!ready || !plan) {
    return (
      <main style={{ padding: space.pageX, maxWidth: 430, margin: "0 auto" }}>
        <p style={{ color: colors.textSecondary }}>{!ready ? "불러오는 중…" : "코스를 찾을 수 없어요."}</p>
        <button type="button" onClick={() => router.push("/")} style={{ marginTop: 12 }}>
          홈으로
        </button>
      </main>
    );
  }

  const idx = Math.min(run.currentStopIndex, plan.stops.length - 1);
  const cur = plan.stops[idx]!;
  const next = plan.stops[idx + 1];
  const travelMin = cur.travelMinutesToNext ?? null;

  return (
    <main style={{ maxWidth: 430, margin: "0 auto", padding: `16px ${space.pageX}px 40px`, background: colors.bgDefault }}>
      <button
        type="button"
        onClick={() => router.push(`/course?id=${encodeURIComponent(plan.id)}`)}
        style={{ border: "none", background: "none", color: colors.accentPrimary, fontWeight: 800, cursor: "pointer" }}
      >
        ← 코스 상세
      </button>
      <p style={{ ...typo.caption, color: colors.textMuted, margin: "12px 0 0", fontWeight: 800 }}>진행 중 코스</p>
      <h1 style={{ ...typo.sectionTitle, marginTop: 6, fontSize: 20 }}>{plan.situationTitle}</h1>
      <p style={{ ...typo.caption, color: colors.textSecondary, margin: "8px 0 0" }}>
        상태 · {run.phase === "active" ? "진행 중" : run.phase === "completed" ? "완료" : run.phase}
      </p>

      <section
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: radius.card,
          background: colors.bgSurface,
          border: `1px solid ${colors.borderSubtle}`,
          boxShadow: shadow.soft,
        }}
      >
        <p style={{ ...typo.caption, color: colors.accentStrong, margin: 0, fontWeight: 900 }}>지금</p>
        <p style={{ ...typo.cardTitle, margin: "6px 0 0", fontWeight: 900 }}>{cur.placeName}</p>
        <p style={{ ...typo.caption, color: colors.textSecondary, margin: "6px 0 0" }}>
          {cur.startTime} 시작 · 약 {cur.dwellMinutes}분
        </p>
      </section>

      {next && (
        <section
          style={{
            marginTop: 12,
            padding: 16,
            borderRadius: radius.card,
            background: colors.bgMuted,
            border: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <p style={{ ...typo.caption, color: colors.textPrimary, margin: 0, fontWeight: 800 }}>다음</p>
          <p style={{ ...typo.body, margin: "6px 0 0", fontWeight: 800 }}>{next.placeName}</p>
          {travelMin != null && (
            <p style={{ ...typo.caption, color: colors.textSecondary, margin: "8px 0 0" }}>
              이동 약 {travelMin}분
            </p>
          )}
        </section>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        <button
          type="button"
          onClick={() => {
            logEvent("course_progress_directions", { course_id: plan.id, stop_index: idx });
            openDirections({ name: cur.placeName, lat: cur.lat ?? null, lng: cur.lng ?? null });
          }}
          style={{
            width: "100%",
            height: 50,
            borderRadius: radius.button,
            border: "none",
            background: colors.accentPrimary,
            color: "#fff",
            fontWeight: 900,
            fontSize: 15,
            cursor: "pointer",
            boxShadow: shadow.cta,
          }}
        >
          길찾기
        </button>
        {next && (
          <button
            type="button"
            onClick={() => {
              advanceCourseToNextStop(plan.id, plan.stops.length);
              logEvent("course_progress_next_stop", { course_id: plan.id, from_index: idx });
              bump();
            }}
            style={{
              width: "100%",
              height: 48,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderStrong}`,
              background: colors.bgSurface,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            다음 장소 보기
          </button>
        )}
        {!next && (
          <p style={{ ...typo.caption, color: colors.textSecondary, textAlign: "center", margin: 0 }}>
            마지막 장소예요. 수고했어요!
          </p>
        )}
      </div>
    </main>
  );
}

export default function CourseProgressPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>로딩…</div>}>
      <CourseProgressInner />
    </Suspense>
  );
}
