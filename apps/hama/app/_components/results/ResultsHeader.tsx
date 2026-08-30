"use client";

import React from "react";
import { colors, space } from "@/lib/designTokens";
import { RESULT_HEADER_COPY, RESULTS_PURPLE, resultsContextLine } from "./resultsPresentation";

type Props = {
  isLoading?: boolean;
  onOpenCriteria?: () => void;
  queryLabel?: string | null;
  now?: Date;
};

export function ResultsHeader({ isLoading, onOpenCriteria, queryLabel, now }: Props) {
  const loading = Boolean(isLoading);
  const contextLine = resultsContextLine(now);
  const situation = String(queryLabel ?? "").trim();

  return (
    <header style={{ marginBottom: space.section }}>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.04em",
          color: RESULTS_PURPLE,
        }}
      >
        HAMA
      </p>
      <h1
        style={{
          margin: "8px 0 0",
          fontSize: "clamp(22px, 6vw, 28px)",
          fontWeight: 800,
          letterSpacing: "-0.04em",
          lineHeight: 1.28,
          color: "#1A1A1A",
          whiteSpace: "pre-line",
        }}
      >
        {loading ? "지금 상황 기준으로\n추천 정리 중이에요…" : RESULT_HEADER_COPY}
      </h1>
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span
          style={{
            borderRadius: 999,
            background: "#F4F0EA",
            color: "#5F5E5A",
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 10px",
          }}
        >
          {contextLine}
        </span>
        {situation ? (
          <span
            style={{
              borderRadius: 999,
              background: "rgba(107, 77, 230, 0.1)",
              color: RESULTS_PURPLE,
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
            }}
          >
            {situation}
          </span>
        ) : null}
        {onOpenCriteria ? (
          <button
            type="button"
            onClick={onOpenCriteria}
            style={{
              marginLeft: "auto",
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: 999,
              background: "#fff",
              color: colors.textPrimary,
              fontSize: 12,
              fontWeight: 800,
              padding: "7px 12px",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            추천 기준 보기 ▾
          </button>
        ) : null}
      </div>
    </header>
  );
}
