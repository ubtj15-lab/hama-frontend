"use client";

import React from "react";
import { colors, space, typo } from "@/lib/designTokens";
import type { ConstraintChip } from "@/lib/conversation/summarize";

export function ActiveConstraintChips({ chips }: { chips: ConstraintChip[] }) {
  if (!chips.length) return null;

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
      {chips.map((c) => (
        <span
          key={c.id}
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
          {c.label}
        </span>
      ))}
    </div>
  );
}
