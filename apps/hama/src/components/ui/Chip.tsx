import React from "react";
import { colors, radius } from "@/lib/designTokens";

type ChipProps = {
  children: React.ReactNode;
};

export function Chip({ children }: ChipProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: colors.neutral[100],
        borderRadius: radius.sm,
        padding: "2px 6px",
        fontSize: 11,
        color: colors.neutral[700],
        fontWeight: 700,
        lineHeight: 1.3,
      }}
    >
      {children}
    </span>
  );
}
