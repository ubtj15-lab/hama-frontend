"use client";

import React from "react";
import type { ReservationPreview } from "@/lib/reservation/bookingTypes";
import { ReservationSummaryCard } from "@/_components/reservation/ReservationSummaryCard";
import { colors, radius, shadow, space, typo } from "@/lib/designTokens";

type Props = {
  firstPlaceName: string;
  preview: ReservationPreview;
  onReserveClick: () => void;
};

/** 코스 상단 — 실행 일정의 첫 식당 예약 요약 + 바로 예약 CTA */
export function CourseReservationTopBlock({ firstPlaceName, preview, onReserveClick }: Props) {
  return (
    <section
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: radius.largeCard,
        background: colors.bgSurface,
        border: `1px solid ${colors.borderSubtle}`,
        boxShadow: shadow.soft,
      }}
      aria-label="첫 단계 예약 안내"
    >
      <p style={{ ...typo.caption, color: colors.accentStrong, margin: 0, fontWeight: 900 }}>1단계 · 식당 예약</p>
      <p style={{ ...typo.cardTitle, fontSize: 17, margin: "8px 0 0", fontWeight: 900 }}>{firstPlaceName}</p>
      <p style={{ ...typo.caption, color: colors.textSecondary, margin: "6px 0 12px", lineHeight: 1.45 }}>
        오늘 {preview.slotLabels.slice(0, 3).join(" · ")} · 예약 가능
      </p>
      <ReservationSummaryCard preview={preview} />
      <button
        type="button"
        onClick={onReserveClick}
        style={{
          width: "100%",
          height: 50,
          marginTop: 14,
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
        지금 예약하고 시작하기
      </button>
    </section>
  );
}
