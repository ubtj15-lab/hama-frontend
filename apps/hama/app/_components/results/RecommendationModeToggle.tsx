"use client";

import React from "react";
import type { RecommendationMode } from "@/lib/scenarioEngine/types";
import { colors, radius, typo } from "@/lib/designTokens";

type Props = {
  mode: RecommendationMode;
  onSelectCourse: () => void;
  onSelectSingle: () => void;
};

export function RecommendationModeToggle({ mode, onSelectCourse, onSelectSingle }: Props) {
  return (
    <div style={{ marginBottom: 16 }}>
      {mode === "single" ? (
        <button
          type="button"
          onClick={onSelectCourse}
          style={{
            ...typo.body,
            width: "100%",
            padding: "12px 14px",
            borderRadius: radius.button,
            border: `1px solid ${colors.borderSubtle}`,
            background: colors.bgCard,
            color: colors.accentPrimary,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          데이트 코스로 보기
        </button>
      ) : (
        <button
          type="button"
          onClick={onSelectSingle}
          style={{
            ...typo.body,
            width: "100%",
            padding: "12px 14px",
            borderRadius: radius.button,
            border: `1px solid ${colors.borderSubtle}`,
            background: colors.bgCard,
            color: colors.accentPrimary,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          식당만 보기
        </button>
      )}
    </div>
  );
}
