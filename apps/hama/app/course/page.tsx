"use client";

import React, { Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import {
  readCoursePlanWithFallback,
  readCourseStepReservationMeta,
  readCourseRunRecord,
  stashCoursePlan,
  encodeCoursePlanSnapshot,
  syncCourseRunOnCoursePageEntry,
} from "@/lib/session/courseSession";
import { logCourseDebug } from "@/lib/course/courseDebugLog";
import { logCourseStartClick } from "@/lib/analytics/courseEvents";
import { colors, radius, shadow, space, typo } from "@/lib/designTokens";
import { courseFirstStopSuggestsReservation, getReservationPreviewForStore } from "@/lib/reservation/bookingDummy";
import { buildReserveQueryFromPlace } from "@/lib/reservation/buildReserveSearchParams";
import { CourseReservationGate } from "@/_components/course/CourseReservationGate";
import { CourseReservationTopBlock } from "@/_components/course/CourseReservationTopBlock";
import { CourseExecutionBar } from "@/_components/course/CourseExecutionBar";
import { CourseTimeline } from "@/_components/detail/CourseTimeline";
import { openDirections } from "@/lib/openDirections";
import { recordPwaEngagement } from "@/lib/pwa/pwaEngagement";
import { logEvent } from "@/lib/logEvent";
import { analyticsFromScenario, mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";

function CourseDetailInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const courseSnapQ = sp.get("courseSnap")?.trim() ?? "";
  const intent = sp.get("intent")?.trim() ?? "";
  const [plan, setPlan] = useState<CoursePlan | null>(null);
  const [restoreAttempted, setRestoreAttempted] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [reserveDone, setReserveDone] = useState(false);
  const [runVersion, setRunVersion] = useState(0);

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
    setReserveDone(Boolean(readCourseStepReservationMeta(plan.id)));
    syncCourseRunOnCoursePageEntry(plan.id);
    setRunVersion((v) => v + 1);
    if (intent === "reserve") {
      const f = plan.stops[0];
      if (f && courseFirstStopSuggestsReservation(f.placeType, String(f.servingType ?? "meal"))) {
        setGateOpen(true);
      }
    }
  }, [plan?.id, plan, intent]);

  const run = useMemo(() => readCourseRunRecord(id), [id, runVersion]);

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
  const firstNeedsReserve =
    Boolean(first) && courseFirstStopSuggestsReservation(first!.placeType, String(first!.servingType ?? "meal"));
  const firstPreview = first ? getReservationPreviewForStore(first.placeId, first.dbCategory ?? null) : null;
  const reserveFirstHref =
    first &&
    `/reserve?${buildReserveQueryFromPlace({
      storeId: first.placeId,
      name: first.placeName,
      courseId: plan.id,
      source: "course",
      stepIndex: 1,
      card: first.cardSnapshot ?? null,
      lat: first.lat ?? null,
      lng: first.lng ?? null,
    }).toString()}`;

  const goResultsWithCourse = () => {
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
  };

  return (
    <main style={{ maxWidth: 430, margin: "0 auto", padding: `16px ${space.pageX}px 40px`, background: colors.bgDefault }}>
      {gateOpen && firstNeedsReserve && first && firstPreview && (
        <CourseReservationGate
          firstPlaceName={first.placeName}
          preview={firstPreview}
          courseId={plan.id}
          placeId={first.placeId}
          analyticsBase={base}
          onClose={() => setGateOpen(false)}
          onConfirmReserve={() => {
            if (reserveFirstHref) router.push(reserveFirstHref);
            setGateOpen(false);
          }}
        />
      )}
      <button
        type="button"
        onClick={() => router.back()}
        style={{ border: "none", background: "none", color: colors.accentPrimary, fontWeight: 800, cursor: "pointer" }}
      >
        ← 뒤로
      </button>
      <CourseExecutionBar courseId={plan.id} stopCount={plan.stops.length} />
      <h1 style={{ ...typo.sectionTitle, marginTop: 12 }}>{plan.situationTitle}</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
        {firstNeedsReserve && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              background: colors.accentSoft,
              color: colors.accentStrong,
              padding: "4px 10px",
              borderRadius: radius.pill,
              border: `1px solid rgba(37, 99, 235, 0.25)`,
            }}
          >
            예약 포함 코스
          </span>
        )}
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
      {firstNeedsReserve && firstPreview && (
        <p style={{ ...typo.caption, color: colors.textSecondary, margin: "10px 0 0", fontWeight: 700, lineHeight: 1.45 }}>
          이 코스는 식당 예약 후 시작하면 좋아요 · 지금 {firstPreview.slotLabels.slice(0, 2).join(" / ")} 예약 가능
        </p>
      )}
      {reserveDone && firstNeedsReserve && (
        <p style={{ ...typo.caption, color: colors.statusOpen, margin: "8px 0 0", fontWeight: 800 }}>
          첫 식당 예약을 완료했어요. 아래에서 일정을 이어가요.
        </p>
      )}
      <p style={{ ...typo.caption, color: colors.textMuted, margin: "12px 0 0", fontWeight: 700 }}>
        실행 상태 · {run.phase === "idle" ? "대기" : run.phase === "confirmed" ? "예약 확정" : run.phase === "active" ? "진행 중" : "완료"}
        {run.reservationId ? ` · 예약 ${run.reservationId.slice(0, 12)}…` : ""}
      </p>
      {firstNeedsReserve && firstPreview && first && (
        <CourseReservationTopBlock
          firstPlaceName={first.placeName}
          preview={firstPreview}
          onReserveClick={() => {
            logEvent("course_top_reserve_click", mergeLogPayload(base, { course_id: plan.id }));
            setGateOpen(true);
          }}
        />
      )}
      <p style={{ ...typo.body, color: colors.textSecondary, marginTop: 12 }}>
        총 약 {Math.round(plan.totalMinutes / 60)}시간{" "}
        {plan.totalMinutes % 60 ? `${plan.totalMinutes % 60}분` : ""}
      </p>
      <h2 style={{ ...typo.cardTitle, marginTop: 24 }}>일정</h2>
      <CourseTimeline stops={plan.stops} />

      {firstNeedsReserve && reserveFirstHref ? (
        <>
          <button
            type="button"
            onClick={() => {
              logEvent("course_reserve_cta_open_gate", mergeLogPayload(base, { course_id: plan.id, place_id: first?.placeId }));
              setGateOpen(true);
            }}
            style={{
              width: "100%",
              height: 54,
              marginTop: 20,
              borderRadius: radius.button,
              border: "none",
              background: colors.accentPrimary,
              color: "#fff",
              fontWeight: 900,
              fontSize: 16,
              cursor: "pointer",
              boxShadow: shadow.cta,
            }}
          >
            이 코스 예약하고 시작하기
          </button>
          <button
            type="button"
            onClick={goResultsWithCourse}
            style={{
              width: "100%",
              height: 48,
              marginTop: 10,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderStrong}`,
              background: colors.bgSurface,
              color: colors.textPrimary,
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            코스 시작하기 (예약 없이)
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={goResultsWithCourse}
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
            boxShadow: shadow.cta,
          }}
        >
          코스 시작하기
        </button>
      )}
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
