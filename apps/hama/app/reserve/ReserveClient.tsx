"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { openNaverPlace } from "@/lib/openNaverPlace";
import { openDirections } from "@/lib/openDirections";
import { logEvent } from "@/lib/logEvent";
import { logRecommendationEvent } from "@/lib/analytics/logRecommendationEvent";
import { courseScenarioFieldsFromObject } from "@/lib/analytics/recommendationContext";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { getReservationPreviewForStore } from "@/lib/reservation/bookingDummy";
import type { ReservationPreview } from "@/lib/reservation/bookingTypes";
import { colors, radius, shadow, space, typo } from "@/lib/designTokens";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import {
  markCourseStepReservationComplete,
  readCoursePlanWithFallback,
  stashCoursePlan,
} from "@/lib/session/courseSession";
import { CourseTimeline } from "@/_components/detail/CourseTimeline";

type FlowStep = "pick" | "deposit" | "done";

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function ReserveClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || searchParams.get("q") || "";
  const storeId = searchParams.get("storeId") ?? "";
  const naverPlaceId = searchParams.get("naverPlaceId") ?? "";
  const category = searchParams.get("category") ?? "";
  const courseId = searchParams.get("courseId")?.trim() ?? "";
  const rawSource = searchParams.get("source");
  const source = rawSource ?? (courseId ? "course" : "place");
  const stepIndexN = Math.max(1, parseInt(searchParams.get("stepIndex") ?? "1", 10) || 1);
  const phone = searchParams.get("phone") ?? "";
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const lat = latRaw != null && latRaw !== "" ? Number(latRaw) : null;
  const lng = lngRaw != null && lngRaw !== "" ? Number(lngRaw) : null;

  const preview: ReservationPreview = useMemo(
    () => (storeId ? getReservationPreviewForStore(storeId, category || null) : getReservationPreviewForStore("unknown", null)),
    [storeId, category]
  );

  const [step, setStep] = useState<FlowStep>("pick");
  const [party, setParty] = useState(2);
  const [timeLabel, setTimeLabel] = useState(() => preview.slotLabels[0] ?? "18:00");
  const [doneCoursePlan, setDoneCoursePlan] = useState<CoursePlan | null>(null);

  useEffect(() => {
    setTimeLabel(preview.slotLabels[0] ?? "18:00");
  }, [preview.slotLabels]);

  useEffect(() => {
    if (name || storeId) {
      logEvent("reserve_flow_start", {
        store_id: storeId,
        name,
        page: "reserve",
        source,
        course_id: courseId || undefined,
        step_index: courseId ? stepIndexN : undefined,
      });
      const { plan } = courseId ? readCoursePlanWithFallback(courseId) : { plan: null as CoursePlan | null };
      const scObj: ScenarioObject | null = plan
        ? {
            intentType: "course_generation",
            scenario: plan.scenario,
            rawQuery: plan.situationTitle ?? name,
            confidence: 0.8,
          }
        : null;
      logRecommendationEvent({
        event_name: "reservation_create",
        entity_type: "reservation",
        entity_id: storeId || "unknown",
        place_ids: [storeId].filter(Boolean),
        ...(scObj ? courseScenarioFieldsFromObject(scObj) : {}),
        source_page: "reserve",
        template_id: plan?.templateId ?? null,
        step_pattern: plan ? plan.template.join(">") : null,
        metadata: { name, source, course_id: courseId || null, step_index: stepIndexN },
      });
    }
  }, [name, storeId, courseId, source, stepIndexN]);

  useEffect(() => {
    if (step !== "done" || !courseId) {
      if (step !== "done") setDoneCoursePlan(null);
      return;
    }
    const { plan } = readCoursePlanWithFallback(courseId);
    setDoneCoursePlan(plan);
  }, [step, courseId]);

  const dateLabel = "오늘";

  const handleOpenNaver = () => {
    logEvent("reserve_naver_click", { store_id: storeId, name, page: "reserve" });
    openNaverPlace({
      name: name || "매장",
      naverPlaceId: naverPlaceId || null,
    });
  };

  const handleConfirmReservation = () => {
    logEvent("reserve_flow_complete", {
      store_id: storeId,
      name,
      date: dateLabel,
      time: timeLabel,
      party,
      page: "reserve",
      deposit_won: preview.depositWon,
      source,
      course_id: courseId || undefined,
      step_index: courseId ? stepIndexN : undefined,
    });
    const { plan: pl } = courseId ? readCoursePlanWithFallback(courseId) : { plan: null as CoursePlan | null };
    const scDone: ScenarioObject | null = pl
      ? { intentType: "course_generation", scenario: pl.scenario, rawQuery: pl.situationTitle ?? name, confidence: 0.8 }
      : null;
    logRecommendationEvent({
      event_name: "reservation_complete",
      entity_type: "reservation",
      entity_id: storeId || "unknown",
      place_ids: [storeId].filter(Boolean),
      ...(scDone ? courseScenarioFieldsFromObject(scDone) : {}),
      source_page: "reserve",
      template_id: pl?.templateId ?? null,
      step_pattern: pl ? pl.template.join(">") : null,
      metadata: { time: timeLabel, party, name, source, course_id: courseId || null },
    });
    if (courseId && source === "course") {
      markCourseStepReservationComplete({
        courseId,
        stepIndex: stepIndexN,
        storeId,
        timeLabel,
        party,
      });
      const { plan } = readCoursePlanWithFallback(courseId);
      if (plan) stashCoursePlan(plan);
    }
    setStep("done");
  };

  const goCourseContinue = () => {
    if (!courseId) return;
    logEvent("reserve_continue_course", { course_id: courseId, store_id: storeId });
    router.push(`/course?id=${encodeURIComponent(courseId)}`);
  };

  const firstStop = doneCoursePlan?.stops[0];
  const dirLat = firstStop?.lat ?? lat;
  const dirLng = firstStop?.lng ?? lng;
  const dirName = firstStop?.placeName ?? name;
  const isCourseReserve = Boolean(courseId && source === "course");

  if (!name && !storeId) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: space.pageX,
          background: colors.bgDefault,
        }}
      >
        <div style={{ maxWidth: 430, margin: "0 auto" }}>
          <Link
            href="/"
            style={{
              display: "inline-block",
              marginBottom: 20,
              fontSize: 14,
              color: colors.accentPrimary,
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            ← 홈으로
          </Link>
          <div
            style={{
              padding: 20,
              background: colors.bgSurface,
              borderRadius: radius.card,
              boxShadow: shadow.soft,
              color: colors.textSecondary,
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            매장 정보가 없어요. 상세 화면에서 &quot;지금 예약하기&quot;로 들어와 주세요.
          </div>
        </div>
      </main>
    );
  }

  const hasDeposit = preview.depositWon != null && preview.depositWon > 0;
  const depositLine =
    hasDeposit && preview.depositWon != null
      ? `예약금 ${preview.depositWon.toLocaleString("ko-KR")}원은 방문 시 자동 차감돼요`
      : "예약금 없이 확정됐어요";

  const chipBase = (active: boolean): React.CSSProperties => ({
    padding: "12px 14px",
    borderRadius: radius.button,
    border: "none",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    background: active ? colors.accentPrimary : colors.bgMuted,
    color: active ? colors.accentOnPrimary : colors.textPrimary,
    boxShadow: active ? shadow.cta : "none",
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: `16px ${space.pageX}px 40px`,
        background: colors.bgDefault,
      }}
    >
      <div style={{ maxWidth: 430, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => {
              if (step === "deposit") setStep("pick");
              else if (step === "pick") router.back();
              else router.back();
            }}
            style={{
              padding: "8px 12px",
              borderRadius: radius.pill,
              border: "none",
              background: colors.bgSurface,
              boxShadow: shadow.soft,
              fontSize: 13,
              fontWeight: 800,
              color: colors.textPrimary,
              cursor: "pointer",
            }}
          >
            ← {step === "done" ? "닫기" : "뒤로"}
          </button>
          <h1 style={{ ...typo.sectionTitle, fontSize: 16, margin: 0, color: colors.textPrimary }}>예약</h1>
          <div style={{ width: 56 }} />
        </header>

        <div
          style={{
            padding: 16,
            background: colors.bgSurface,
            borderRadius: radius.card,
            boxShadow: shadow.soft,
            marginBottom: 12,
            border: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <p style={{ ...typo.caption, color: colors.textMuted, margin: 0, fontWeight: 700 }}>매장</p>
          <p style={{ ...typo.cardTitle, fontSize: 19, margin: "6px 0 0", fontWeight: 900 }}>{name || "매장"}</p>
          {courseId && (
            <p style={{ ...typo.caption, color: colors.accentStrong, margin: "8px 0 0", fontWeight: 700 }}>
              코스 첫 단계 식당 예약으로 이어져요
            </p>
          )}
        </div>

        {step === "pick" && (
          <>
            <section
              style={{
                padding: 18,
                background: colors.bgSurface,
                borderRadius: radius.card,
                boxShadow: shadow.soft,
                marginBottom: 12,
                border: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <p style={{ ...typo.caption, color: colors.textMuted, margin: 0, fontWeight: 800 }}>STEP 1</p>
              <p style={{ ...typo.cardTitle, margin: "6px 0 14px", fontWeight: 900 }}>언제, 몇 명이에요?</p>
              <p style={{ ...typo.body, color: colors.textSecondary, margin: "0 0 12px" }}>날짜 · {dateLabel}</p>

              <p style={{ ...typo.caption, fontWeight: 800, color: colors.textPrimary, margin: "0 0 8px" }}>인원</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PARTY_OPTIONS.map((n) => (
                  <button key={n} type="button" onClick={() => setParty(n)} style={chipBase(party === n)}>
                    {n}명
                  </button>
                ))}
              </div>

              <p style={{ ...typo.caption, fontWeight: 800, color: colors.textPrimary, margin: "18px 0 8px" }}>시간</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {preview.slotLabels.map((t) => (
                  <button key={t} type="button" onClick={() => setTimeLabel(t)} style={chipBase(timeLabel === t)}>
                    {t}
                  </button>
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={() => {
                logEvent("reserve_step_pick_next", { store_id: storeId, party, time: timeLabel });
                setStep("deposit");
              }}
              style={{
                width: "100%",
                height: 52,
                borderRadius: radius.button,
                border: "none",
                background: colors.accentPrimary,
                color: colors.accentOnPrimary,
                fontWeight: 900,
                fontSize: 16,
                cursor: "pointer",
                boxShadow: shadow.cta,
              }}
            >
              다음
            </button>
          </>
        )}

        {step === "deposit" && (
          <>
            <section
              style={{
                padding: 18,
                background: colors.bgSurface,
                borderRadius: radius.card,
                boxShadow: shadow.soft,
                marginBottom: 12,
                border: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <p style={{ ...typo.caption, color: colors.textMuted, margin: 0, fontWeight: 800 }}>STEP 2</p>
              <p style={{ ...typo.cardTitle, margin: "6px 0 12px", fontWeight: 900 }}>예약금 · 정책 확인</p>

              <div
                style={{
                  padding: 14,
                  borderRadius: radius.card,
                  background: colors.accentSoft,
                  border: `1px solid ${colors.borderSubtle}`,
                  marginBottom: 12,
                }}
              >
                <p style={{ ...typo.body, margin: 0, fontWeight: 800, color: colors.textPrimary }}>
                  {dateLabel} {timeLabel} · {party}명
                </p>
                <p style={{ ...typo.caption, margin: "8px 0 0", color: colors.textSecondary, lineHeight: 1.5 }}>
                  {name}
                </p>
              </div>

              {!hasDeposit ? (
                <p style={{ ...typo.body, color: colors.textPrimary, lineHeight: 1.55, margin: 0 }}>
                  예약금 없음 — 바로 확정 단계로 넘어가요.
                </p>
              ) : (
                <>
                  <p style={{ ...typo.body, color: colors.textPrimary, fontWeight: 800, margin: "0 0 6px" }}>
                    예약금 {preview.depositWon!.toLocaleString("ko-KR")}원
                  </p>
                  <p style={{ ...typo.caption, color: colors.textSecondary, lineHeight: 1.55, margin: "0 0 10px" }}>
                    {preview.depositCaption}
                  </p>
                  <p style={{ ...typo.caption, color: colors.textMuted, lineHeight: 1.5, margin: 0 }}>
                    {preview.noShowSoftNote}
                  </p>
                </>
              )}

              {preview.premiumPerks?.depositWaiverAvailable && (
                <p
                  style={{
                    ...typo.caption,
                    margin: "14px 0 0",
                    padding: "10px 12px",
                    borderRadius: radius.chip,
                    background: colors.bgMuted,
                    color: colors.textSecondary,
                    lineHeight: 1.45,
                  }}
                >
                  {preview.premiumPerks.label}
                  <span style={{ opacity: 0.85 }}> · 곧 연동 예정</span>
                </p>
              )}
            </section>

            <button
              type="button"
              onClick={handleConfirmReservation}
              style={{
                width: "100%",
                height: 52,
                borderRadius: radius.button,
                border: "none",
                background: colors.accentPrimary,
                color: colors.accentOnPrimary,
                fontWeight: 900,
                fontSize: 16,
                cursor: "pointer",
                boxShadow: shadow.cta,
              }}
            >
              예약 확정하기
            </button>
          </>
        )}

        {step === "done" && (
          <section
            style={{
              padding: 20,
              background: colors.bgSurface,
              borderRadius: radius.largeCard,
              boxShadow: shadow.elevated,
              border: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <p style={{ ...typo.caption, color: colors.statusOpen, margin: 0, fontWeight: 900 }}>예약 완료</p>
            <p style={{ ...typo.heroTitle, fontSize: 22, margin: "10px 0 0", color: colors.textPrimary }}>{name}</p>
            <p style={{ ...typo.body, margin: "12px 0 0", fontWeight: 800, color: colors.textPrimary }}>
              {dateLabel} {timeLabel} · {party}명
            </p>
            <p style={{ ...typo.caption, margin: "10px 0 0", color: colors.textSecondary, lineHeight: 1.55 }}>{depositLine}</p>
            <p style={{ ...typo.caption, margin: "14px 0 0", color: colors.textMuted, lineHeight: 1.45 }}>
              실제 착석·결제는 매장 정책에 따라 달라요. 네이버 예약에서도 이어서 확인할 수 있어요.
            </p>

            {isCourseReserve && doneCoursePlan && (
              <>
                <h3 style={{ ...typo.sectionTitle, fontSize: 16, margin: "22px 0 0" }}>코스 전체 일정</h3>
                <div style={{ marginTop: 12 }}>
                  <CourseTimeline stops={doneCoursePlan.stops} />
                </div>
              </>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
              {isCourseReserve && dirLat != null && dirLng != null && !Number.isNaN(dirLat) && !Number.isNaN(dirLng) && (
                <button
                  type="button"
                  onClick={() => {
                    logEvent("reserve_done_first_stop_directions", { store_id: storeId, course_id: courseId });
                    openDirections({ name: dirName || "첫 장소", lat: dirLat, lng: dirLng });
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
                  첫 장소 길찾기
                </button>
              )}
              {isCourseReserve && courseId && (
                <button
                  type="button"
                  onClick={goCourseContinue}
                  style={{
                    width: "100%",
                    height: 52,
                    borderRadius: radius.button,
                    border: "none",
                    background: colors.accentPrimary,
                    color: colors.accentOnPrimary,
                    fontWeight: 900,
                    fontSize: 15,
                    cursor: "pointer",
                    boxShadow: shadow.cta,
                  }}
                >
                  코스 계속 보기
                </button>
              )}
              {!isCourseReserve && lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng) && (
                <button
                  type="button"
                  onClick={() => {
                    logEvent("reserve_done_directions", { store_id: storeId });
                    openDirections({ name: name || "매장", lat, lng });
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
                  길찾기로 바로 이동
                </button>
              )}
              {phone && (
                <button
                  type="button"
                  onClick={() => {
                    logEvent("reserve_done_call", { store_id: storeId });
                    window.location.href = `tel:${phone.replace(/[^0-9+]/g, "")}`;
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
                  전화하기
                </button>
              )}
              {!isCourseReserve && courseId && (
                <button
                  type="button"
                  onClick={goCourseContinue}
                  style={{
                    width: "100%",
                    height: 52,
                    borderRadius: radius.button,
                    border: "none",
                    background: colors.accentPrimary,
                    color: colors.accentOnPrimary,
                    fontWeight: 900,
                    fontSize: 15,
                    cursor: "pointer",
                    boxShadow: shadow.cta,
                  }}
                >
                  이 코스로 이어가기
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenNaver}
                style={{
                  width: "100%",
                  height: 48,
                  borderRadius: radius.button,
                  border: "none",
                  background: "#03C75A",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                네이버에서 예약·확인하기
              </button>
              <Link
                href="/"
                style={{
                  display: "block",
                  width: "100%",
                  height: 44,
                  lineHeight: "44px",
                  borderRadius: radius.button,
                  background: colors.bgMuted,
                  color: colors.textPrimary,
                  fontWeight: 700,
                  fontSize: 14,
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                홈으로
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
