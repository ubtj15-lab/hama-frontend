"use client";

import React from "react";
import { colors, space, typo } from "@/lib/designTokens";

export function HomeHero() {
  return (
    <header style={{ marginBottom: space.sectionTight, paddingTop: 4 }}>
      <h1
        style={{
          ...typo.heroTitle,
          color: colors.textPrimary,
          margin: 0,
          lineHeight: 1.22,
        }}
      >
        오늘 뭐할지{" "}
        <span
          style={{
            background: `linear-gradient(transparent 64%, ${colors.primaryLight} 64%)`,
            padding: "0 2px",
          }}
        >
          고민돼?
        </span>
      </h1>
      <p
        style={{
          ...typo.body,
          color: colors.textSecondary,
          margin: "10px 0 0",
          lineHeight: 1.5,
          fontWeight: 600,
        }}
      >
        상황을 선택하면 하마가 딱 골라줄게요
      </p>
    </header>
  );
}
