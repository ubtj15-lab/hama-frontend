"use client";

import React from "react";
import { colors, typo } from "@/lib/designTokens";

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        ...typo.sectionTitle,
        color: colors.textPrimary,
        margin: 0,
        letterSpacing: "-0.02em",
      }}
    >
      {children}
    </h2>
  );
}
