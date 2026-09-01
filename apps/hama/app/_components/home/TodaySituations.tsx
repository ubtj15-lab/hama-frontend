"use client";

import React, { useMemo, useState } from "react";
import { logEvent } from "@/lib/logEvent";
import type { HomeResultsNavParams } from "@/lib/homeResultsNavParams";
import { HOME_SITUATION_CANDIDATES, type HomeSituationCandidate } from "./homeSituationCandidates";
import { selectHomeSituationSlots } from "./homeSituationSelector";

export type HomeSituationItem = {
  id: string;
  title: string;
  line1: string;
  line2: string;
  mark: string;
  query: string;
  nav?: HomeResultsNavParams;
  layout: "tallLeft" | "topRight" | "bottomLeft" | "tallRight";
  bg: string;
};

const SLOT_LAYOUT: HomeSituationItem["layout"][] = ["tallLeft", "topRight", "bottomLeft", "tallRight"];

const FAMILY_BG: Record<string, string> = {
  family: "#FFF1E6",
  date: "#F1ECFF",
  food: "#FFF6E4",
  outdoor: "#E8F5EE",
  indoor: "#EEF2F7",
  culture: "#F3EEF8",
  relax: "#F4F0EA",
  discovery: "#FFF7EC",
};

function toSlotItem(candidate: HomeSituationCandidate, index: number): HomeSituationItem {
  return {
    id: candidate.id,
    title: candidate.displayTitle,
    line1: candidate.line1,
    line2: candidate.line2,
    mark: candidate.icon,
    query: candidate.query,
    layout: SLOT_LAYOUT[index] ?? "topRight",
    bg: FAMILY_BG[candidate.semanticFamily] ?? "#F4F0EA",
  };
}

/** Default recognizable V4 set — library fallback, not the live contextual slots. */
export const HOME_SITUATIONS: HomeSituationItem[] = ["family_outing", "date", "food", "outdoor_walk"]
  .map((id) => HOME_SITUATION_CANDIDATES.find((c) => c.id === id))
  .filter((c): c is HomeSituationCandidate => Boolean(c))
  .map((c, i) => toSlotItem(c, i));

/** Existing OPEN_DISCOVERY-compatible general recommendation query. */
export const HOME_SURPRISE = {
  id: "surprise" as const,
  query: "오늘 뭐하지",
  display: "모르겠어, 하마가 골라줘",
};

const LAYOUT_STYLE: Record<HomeSituationItem["layout"], React.CSSProperties> = {
  tallLeft: { gridColumn: 1, gridRow: "1 / 3", minHeight: 168 },
  topRight: { gridColumn: 2, gridRow: 1, minHeight: 80 },
  bottomLeft: { gridColumn: 1, gridRow: 3, minHeight: 80 },
  tallRight: { gridColumn: 2, gridRow: "2 / 4", minHeight: 168 },
};

type Props = {
  onSelect: (item: HomeSituationItem) => void;
  now?: Date;
};

export function TodaySituations({ onSelect, now }: Props) {
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [deckIndex, setDeckIndex] = useState(0);
  const [sessionNow] = useState(() => new Date());
  const clock = now ?? sessionNow;
  const { slots, deckCount } = useMemo(
    () => selectHomeSituationSlots({ now: clock, deckIndex, personalization: {} }),
    [clock, deckIndex]
  );
  const items = slots.map((candidate, index) => toSlotItem(candidate, index));

  return (
    <section aria-labelledby="today-situations-title" style={{ padding: "10px 0 4px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <h2
          id="today-situations-title"
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#3A3A3A",
          }}
        >
          지금 이런 건 어때요?
        </h2>
        <button
          type="button"
          onClick={() => {
            logEvent("home_search_icon_click", { page: "home", source: "situation_deck_refresh" });
            setDeckIndex((i) => (i + 1) % deckCount);
          }}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            color: "#9A958C",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          다른 상황 보기 ›
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "auto auto auto",
          gap: 10,
        }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            onPointerDown={() => setPressedId(item.id)}
            onPointerUp={() => setPressedId(null)}
            onPointerCancel={() => setPressedId(null)}
            aria-label={item.title}
            style={{
              ...LAYOUT_STYLE[item.layout],
              minWidth: 0,
              border: "none",
              borderRadius: 22,
              padding: "16px 14px",
              background: item.bg,
              color: "#2A2A2A",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              transform: pressedId === item.id ? "scale(0.98)" : "scale(1)",
              transition: "transform 120ms ease",
            }}
          >
            <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
              {item.mark}
            </span>
            <span
              style={{
                fontSize: "clamp(15px, 4.1vw, 17px)",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1.28,
              }}
            >
              {item.line1}
              <br />
              {item.line2}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

type SurpriseProps = {
  onSelect: () => void;
};

export function HomeSurpriseMe({ onSelect }: SurpriseProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <section style={{ padding: "12px 0 4px" }}>
      <button
        type="button"
        onClick={onSelect}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        aria-label={HOME_SURPRISE.display}
        style={{
          width: "100%",
          minHeight: 52,
          border: "1.5px dashed #D4C4F5",
          borderRadius: 18,
          background: "#F7F3FF",
          color: "#4B32B0",
          cursor: "pointer",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          transform: pressed ? "scale(0.98)" : "scale(1)",
          transition: "transform 120ms ease",
        }}
      >
        ✨ {HOME_SURPRISE.display}
      </button>
    </section>
  );
}
