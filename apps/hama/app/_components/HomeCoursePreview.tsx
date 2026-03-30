"use client";

import React from "react";
import type { CoursePlan } from "@/lib/scenarioEngine/types";

type Props = {
  plans: CoursePlan[];
  onPick?: (plan: CoursePlan) => void;
};

export default function HomeCoursePreview({ plans, onPick }: Props) {
  if (!plans.length) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 8 }}>코스 미리보기</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plans.map((plan) => (
          <div
            key={plan.id}
            style={{
              borderRadius: 16,
              padding: 12,
              background: "#ffffff",
              boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 4 }}>{plan.title}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
              약 {Math.round(plan.totalMinutes / 60)}시간 {plan.totalMinutes % 60}분 · {plan.summaryLine}
            </div>
            <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.4, marginBottom: 10 }}>
              {plan.stops.map((s, i) => (
                <div key={`${s.placeId}-${i}`}>
                  {s.startTime} {s.placeName} ({s.placeType})
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onPick?.(plan)}
              style={{
                width: "100%",
                height: 36,
                borderRadius: 10,
                border: "none",
                background: "#0f172a",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              이 코스로 보기
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
