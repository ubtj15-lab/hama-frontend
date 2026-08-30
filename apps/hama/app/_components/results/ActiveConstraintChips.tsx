"use client";

import React from "react";
import { colors, space, typo } from "@/lib/designTokens";
import type { ConstraintChip } from "@/lib/conversation/summarize";
import { dedupeDisplayChips } from "./resultsPresentation";

export function ActiveConstraintChips({
  chips,
  excludeLabels = [],
}: {
  chips: ConstraintChip[];
  excludeLabels?: string[];
}) {
  const visibleLabels = dedupeDisplayChips([
    ...excludeLabels,
    ...chips.map((c) => c.label),
  ]).filter((label) => !excludeLabels.some((ex) => ex.trim() === label));
  if (!visibleLabels.length) return null;

  return (
    <div
      role="list"
      aria-label="지금 이해한 조건"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: space.section,
      }}
    >
      {visibleLabels.map((label) => (
        <span
          key={label}
          role="listitem"
          style={{
            ...typo.caption,
            fontSize: 12,
            fontWeight: 600,
            color: colors.accentPrimary,
            background: `${colors.accentPrimary}14`,
            borderRadius: 999,
            padding: "6px 12px",
            maxWidth: "100%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
