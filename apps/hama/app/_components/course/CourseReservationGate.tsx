"use client";

import React from "react";
import type { AnalyticsContext } from "@/lib/analytics/buildLogPayload";
import { mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import { logEvent } from "@/lib/logEvent";
import { ReservationSummaryCard } from "@/_components/reservation/ReservationSummaryCard";
import type { ReservationPreview } from "@/lib/reservation/bookingTypes";
import { colors, radius, shadow, space, typo } from "@/lib/designTokens";

type Props = {
  firstPlaceName: string;
  preview: ReservationPreview;
  onClose: () => void;
  onConfirmReserve: () => void;
  analyticsBase: AnalyticsContext;
  courseId: string;
  placeId: string;
};

/**
 * 코스 CTA → 첫 식당 예약이 필요할 때 끊기지 않게 보여 주는 안내 레이어.
 */
export function CourseReservationGate({
  firstPlaceName,
  preview,
  onClose,
  onConfirmReserve,
  analyticsBase,
  courseId,
  placeId,
}: Props) {
  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="course-gate-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15,23,42,0.48)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          maxHeight: "94vh",
          overflow: "auto",
          background: colors.bgDefault,
          borderTopLeftRadius: radius.largeCard,
          borderTopRightRadius: radius.largeCard,
          padding: `22px ${space.pageX}px 28px`,
          boxShadow: shadow.elevated,
        }}
      >
        <p style={{ ...typo.caption, color: colors.accentStrong, margin: 0, fontWeight: 900 }}>코스 예약</p>
        <h2 id="course-gate-title" style={{ ...typo.sectionTitle, fontSize: 20, margin: "10px 0 0", lineHeight: 1.35 }}>
          이 코스를 시작하려면
          <br />
          첫 번째 식당 예약이 필요해요
        </h2>
        <p style={{ ...typo.body, color: colors.textSecondary, margin: "12px 0 0", lineHeight: 1.5 }}>
          코스는 첫 식당부터 이어지는 일정이에요. 자리만 잡으면 바로 다음 단계로 안내할게요.
        </p>

        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: radius.card,
            background: colors.bgSurface,
            border: `1px solid ${colors.borderSubtle}`,
            boxShadow: shadow.soft,
          }}
        >
          <p style={{ ...typo.caption, color: colors.textMuted, margin: 0, fontWeight: 700 }}>첫 번째 장소</p>
          <p style={{ ...typo.cardTitle, fontSize: 17, margin: "6px 0 0", fontWeight: 900 }}>{firstPlaceName}</p>
          <p style={{ ...typo.caption, color: colors.textSecondary, margin: "8px 0 0" }}>
            오늘 {preview.slotLabels.slice(0, 3).join(" · ")} 예약 가능
          </p>
        </div>

        <div style={{ marginTop: 12 }}>
          <ReservationSummaryCard preview={preview} />
        </div>

        <button
          type="button"
          onClick={() => {
            logEvent(
              "course_reserve_gate_confirm",
              mergeLogPayload(analyticsBase, {
                course_id: courseId,
                place_id: placeId,
                page: "course_gate",
              })
            );
            onConfirmReserve();
          }}
          style={{
            width: "100%",
            height: 54,
            marginTop: 18,
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
          지금 예약하고 시작하기
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            height: 46,
            marginTop: 10,
            borderRadius: radius.button,
            border: `1px solid ${colors.borderStrong}`,
            background: colors.bgSurface,
            color: colors.textPrimary,
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
