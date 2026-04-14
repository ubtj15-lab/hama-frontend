"use client";

import React from "react";
import { colors, space, typo } from "@/lib/designTokens";

export function HomeHero() {
  return (
    <header style={{ marginBottom: space.heroBottom, paddingTop: 4 }}>
      <h1
        style={{
          ...typo.heroTitle,
          color: colors.textPrimary,
          margin: 0,
          lineHeight: 1.22,
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
          fontWeight: 500,
        }}
      >
        상황만 말해주면 바로 골라줄게
      </p>
    </header>
  );
}
