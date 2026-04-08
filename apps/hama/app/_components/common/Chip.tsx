"use client";

import React from "react";
import { colors, radius } from "@/lib/designTokens";

type Props = { children: React.ReactNode; variant?: "soft" | "outline" };

export function Chip({ children, variant = "soft" }: Props) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: radius.pill,
        fontSize: 12,
        fontWeight: 700,
        background: variant === "soft" ? colors.accentSoft : "transparent",
        color: variant === "soft" ? colors.accentStrong : colors.textSecondary,
        border: variant === "outline" ? `1px solid ${colors.borderSubtle}` : "none",
      }}
    >
      {children}
    </span>
  );
}
