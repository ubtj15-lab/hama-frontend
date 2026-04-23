"use client";

import React from "react";
import type { ReservationPreview } from "@/lib/reservation/bookingTypes";
import { colors, radius, shadow, typo } from "@/lib/designTokens";

type Props = {
  preview: ReservationPreview;
};

/**
 * 매장 상단 — 예약 전에 “지금 잡을 수 있는지 / 예약금”을 먼저 보여 주는 카드.
 */
export function ReservationSummaryCard({ preview }: Props) {
  const slots = preview.slotLabels.join(" · ");
  const hasDeposit = preview.depositWon != null && preview.depositWon > 0;

  return (
    <section
      style={{
        marginTop: 18,
        borderRadius: radius.card,
        background: colors.bgSurface,
        border: `1px solid ${colors.borderSubtle}`,
        boxShadow: shadow.soft,
        padding: "16px 16px 14px",
      }}
      aria-label="예약 정보 요약"
    >
      <p style={{ ...typo.caption, color: colors.textMuted, margin: 0, fontWeight: 800, letterSpacing: "0.04em" }}>
        오늘 예약
      </p>
      <p style={{ ...typo.cardTitle, fontSize: 16, margin: "8px 0 0", fontWeight: 900, color: colors.textPrimary }}>
        {preview.availableToday ? (
          <>
            <span style={{ color: colors.statusOpen }}>가능</span>
            <span style={{ fontWeight: 700, color: colors.textSecondary }}> · {slots}</span>
          </>
        ) : (
          <span style={{ color: colors.textSecondary }}>지금은 전화로 확인해 주세요</span>
        )}
      </p>
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${colors.borderSubtle}`,
        }}
      >
        {!hasDeposit ? (
          <p style={{ ...typo.body, margin: 0, color: colors.textPrimary, fontWeight: 700 }}>
            예약금 없음 · 바로 예약 가능
          </p>
        ) : (
          <>
            <p style={{ ...typo.body, margin: 0, color: colors.textPrimary, fontWeight: 800 }}>
              예약금 {preview.depositWon!.toLocaleString("ko-KR")}원
            </p>
            <p style={{ ...typo.caption, margin: "6px 0 0", color: colors.textSecondary, lineHeight: 1.45 }}>
              방문 시 전액 차감 · {preview.depositCaption}
            </p>
          </>
        )}
      </div>
      {preview.premiumPerks?.depositWaiverAvailable && (
        <p
          style={{
            ...typo.caption,
            margin: "12px 0 0",
            padding: "8px 10px",
            borderRadius: radius.chip,
            background: colors.accentSoft,
            color: colors.accentStrong,
            fontWeight: 700,
          }}
        >
          {preview.premiumPerks.label}
          <span style={{ fontWeight: 600, opacity: 0.85 }}> (준비 중)</span>
        </p>
      )}
    </section>
  );
}
