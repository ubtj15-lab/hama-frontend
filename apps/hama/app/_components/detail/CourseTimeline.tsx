"use client";

import React from "react";
import type { CourseStop } from "@/lib/scenarioEngine/types";
import { colors, typo } from "@/lib/designTokens";

export function CourseTimeline({ stops }: { stops: CourseStop[] }) {
  return (
    <ol style={{ paddingLeft: 18, margin: "12px 0 0" }}>
      {stops.map((s, i) => (
        <li key={`${s.placeId}-${i}`} style={{ marginBottom: 14, ...typo.body, color: colors.textPrimary }}>
          <strong>{s.startTime}</strong> {s.placeName}
          <div style={{ fontSize: 12, color: colors.textSecondary }}>{s.placeType}</div>
        </li>
      ))}
    </ol>
  );
}
