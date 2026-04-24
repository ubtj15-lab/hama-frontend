"use client";

import React from "react";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { getNextSuggestions, type GetNextSuggestionsOptions } from "@/lib/recommendation/getNextSuggestions";
import { SectionTitle } from "@/_components/common/SectionTitle";
import { colors, radius, space } from "@/lib/designTokens";
import { logEvent } from "@/lib/logEvent";
import { mergeLogPayload, analyticsFromScenario } from "@/lib/analytics/buildLogPayload";

type Props = {
  scenarioObject: ScenarioObject | null;
  onSelect: (query: string, suggestionLabel?: string) => void;
  suggestionOptions?: GetNextSuggestionsOptions;
};

export function NextSuggestions({ scenarioObject, onSelect, suggestionOptions }: Props) {
  const items = getNextSuggestions(scenarioObject, suggestionOptions);
  const title = "이렇게 이어가도 좋아";
  const base = analyticsFromScenario(scenarioObject);

  return (
    <section style={{ marginTop: space.section + 8 }}>
      <SectionTitle>{title}</SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 10,
          marginTop: 12,
        }}
      >
        {items.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              logEvent(
                "next_suggestion_click",
                mergeLogPayload(base, { suggestion_id: s.id, suggestion_label: s.label, card_rank: i })
              );
              onSelect(s.query, s.label);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              borderRadius: radius.card,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgCard,
              cursor: "pointer",
              textAlign: "left",
              fontSize: 15,
              fontWeight: 800,
              color: colors.textPrimary,
              boxShadow: "0 4px 14px rgba(15,23,42,0.05)",
            }}
          >
            <span style={{ fontSize: 22, display: "inline-flex", alignItems: "center" }} aria-hidden>
              {s.icon}
            </span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
