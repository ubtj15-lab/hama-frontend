"use client";

import React from "react";
import {
  RECOMMENDATION_REJECT_REASONS,
  RECOMMENDATION_REJECT_REASON_LABELS,
  type RecommendationRejectReason,
} from "@/lib/analytics/recommendationRejectReasons";

type Props = {
  onSelect: (reason: RecommendationRejectReason) => void;
  onSkip: () => void;
};

/** Optional one-tap reason chips. Never blocks shuffle/navigation. */
export function ContextualRejectReasonBar({ onSelect, onSkip }: Props) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: "10px 10px 8px",
        borderRadius: 12,
        border: "1px solid #E2E8F0",
        background: "#F8FAFC",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>왜 아쉬웠는지 알려줄래요? (선택)</span>
        <button
          type="button"
          onClick={onSkip}
          style={{
            border: "none",
            background: "transparent",
            color: "#64748B",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            padding: 0,
          }}
        >
          건너뛰기
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {RECOMMENDATION_REJECT_REASONS.map((reason) => (
          <button
            key={reason}
            type="button"
            onClick={() => onSelect(reason)}
            style={{
              border: "1px solid #CBD5E1",
              background: "#fff",
              color: "#334155",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            {RECOMMENDATION_REJECT_REASON_LABELS[reason]}
          </button>
        ))}
      </div>
    </div>
  );
}
