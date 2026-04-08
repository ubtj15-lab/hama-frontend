"use client";

import React from "react";
import { colors, space, typo } from "@/lib/designTokens";

export function HomeHero() {
  return (
    <header style={{ marginBottom: space.section, paddingTop: 8 }}>
      <h1
        style={{
          ...typo.title,
          color: colors.textPrimary,
          margin: 0,
          lineHeight: 1.2,
          letterSpacing: "-0.03em",
        }}
      >
        오늘 어디 갈지 고민 중이야?
      </h1>
      <p
        style={{
          ...typo.body,
          color: colors.textSecondary,
          margin: "10px 0 0",
          lineHeight: 1.5,
        }}
      >
        상황만 말해주면 바로 골라줄게
      </p>
    </header>
  );
}
