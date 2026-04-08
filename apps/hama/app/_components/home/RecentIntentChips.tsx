"use client";

/** 홈 메인에서는 마운트하지 않음(결정형 첫 화면). 필요 시 `app/page.tsx`에서 import 후 배치. */

import React, { useEffect, useState } from "react";
import { readRecentIntents } from "@/lib/recentIntents";
import { colors, radius, space } from "@/lib/designTokens";

type Props = { onPick: (query: string) => void };

export function RecentIntentChips({ onPick }: Props) {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    setItems(readRecentIntents().slice(0, 4));
  }, []);

  if (!items.length) return null;

  return (
    <div style={{ marginBottom: space.section }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: colors.textSecondary, marginBottom: 10 }}>
        최근에 많이 찾았어
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: space.chip }}>
        {items.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            style={{
              padding: "8px 14px",
              borderRadius: radius.pill,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgMuted,
              fontSize: 13,
              fontWeight: 700,
              color: colors.textPrimary,
              cursor: "pointer",
            }}
          >
            {q.length > 16 ? `${q.slice(0, 16)}…` : q}
          </button>
        ))}
      </div>
    </div>
  );
}
