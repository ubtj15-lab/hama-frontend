"use client";

import React, { useMemo, useState } from "react";
import { logEvent } from "@/lib/logEvent";
import type { HomeResultsNavParams } from "@/lib/homeResultsNavParams";
import {
  ChickIcon,
  CoffeeIcon,
  FamilyIcon,
  FerrisWheelIcon,
  HeartIcon,
  RiceBowlIcon,
  SparkleIcon,
} from "@icons";
import { HOME_PURPLE, HOME_PURPLE_SOFT } from "./homeBetaTheme";
import { HOME_SITUATION_CANDIDATES, type HomeSemanticFamily, type HomeSituationCandidate } from "./homeSituationCandidates";
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
  family: HomeSemanticFamily;
};

const SLOT_LAYOUT: HomeSituationItem["layout"][] = ["tallLeft", "topRight", "bottomLeft", "tallRight"];

const FAMILY_BG: Record<HomeSemanticFamily, string> = {
  family: "#FFF1E6",
  date: "#F1ECFF",
  food: "#FFF6E4",
  outdoor: "#E8F5EE",
  indoor: "#EEF2F7",
  culture: "#F3EEF8",
  relax: "#F4F0EA",
  discovery: "#FFF7EC",
};

const FAMILY_INK: Record<HomeSemanticFamily, string> = {
  family: "#C46A32",
  date: "#6B4DE6",
  food: "#C47A1A",
  outdoor: "#2A8A62",
  indoor: "#4A6A8A",
  culture: "#7A4A9A",
  relax: "#7A6550",
  discovery: "#C47A1A",
};

const FAMILY_BLOB: Record<HomeSemanticFamily, string> = {
  family: "rgba(255, 176, 128, 0.38)",
  date: "rgba(167, 148, 232, 0.32)",
  food: "rgba(255, 206, 112, 0.4)",
  outdoor: "rgba(122, 196, 158, 0.35)",
  indoor: "rgba(154, 178, 204, 0.32)",
  culture: "rgba(186, 154, 214, 0.32)",
  relax: "rgba(196, 176, 150, 0.32)",
  discovery: "rgba(255, 206, 128, 0.38)",
};

function SituationGlyph({ family, size = 22 }: { family: HomeSemanticFamily; size?: number }) {
  const color = FAMILY_INK[family];
  if (family === "family") return <FamilyIcon size={size} color={color} />;
  if (family === "date") return <HeartIcon size={size} color={color} />;
  if (family === "food") return <RiceBowlIcon size={size} color={color} />;
  if (family === "outdoor") return <FerrisWheelIcon size={size} color={color} />;
  if (family === "indoor") return <ChickIcon size={size} color={color} />;
  if (family === "relax") return <CoffeeIcon size={size} color={color} />;
  return <SparkleIcon size={size} color={color} />;
}

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
    family: candidate.semanticFamily,
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
  tallLeft: { gridColumn: 1, gridRow: "1 / 3", minHeight: 148 },
  topRight: { gridColumn: 2, gridRow: 1, minHeight: 76 },
  bottomLeft: { gridColumn: 1, gridRow: 3, minHeight: 76 },
  tallRight: { gridColumn: 2, gridRow: "2 / 4", minHeight: 148 },
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
    <section aria-labelledby="today-situations-title" style={{ padding: "6px 0 2px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
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
            border: "1px solid #E8E2D8",
            background: "#fff",
            padding: "5px 10px",
            borderRadius: 999,
            color: "#6B6660",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            boxShadow: "0 1px 2px rgba(26, 24, 20, 0.04)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M20 12a8 8 0 1 1-2.2-5.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path d="M20 5v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          다른 상황
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "auto auto auto",
          gap: 8,
        }}
      >
        {items.map((item) => {
          const tall = item.layout === "tallLeft" || item.layout === "tallRight";
          return (
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
                borderRadius: 20,
                padding: tall ? "14px 13px 13px" : "12px 12px",
                background: item.bg,
                color: "#2A2A2A",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                flexDirection: tall ? "column" : "row",
                alignItems: tall ? "flex-start" : "center",
                justifyContent: tall ? "flex-start" : "flex-start",
                gap: tall ? 10 : 10,
                position: "relative",
                overflow: "hidden",
                transform: pressedId === item.id ? "scale(0.98)" : "scale(1)",
                transition: "transform 120ms ease",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: tall ? -18 : -22,
                  right: tall ? -16 : -20,
                  width: tall ? 88 : 64,
                  height: tall ? 88 : 64,
                  borderRadius: "50%",
                  background: FAMILY_BLOB[item.family],
                  pointerEvents: "none",
                }}
              />
              <span
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.72)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <SituationGlyph family={item.family} size={20} />
              </span>
              {tall ? <span style={{ flex: 1, minHeight: 8 }} /> : null}
              <span
                style={{
                  fontSize: tall ? "clamp(15px, 4vw, 16px)" : "clamp(13px, 3.6vw, 15px)",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.28,
                  position: "relative",
                  zIndex: 1,
                  minWidth: 0,
                }}
              >
                {item.line1}
                <br />
                {item.line2}
              </span>
            </button>
          );
        })}
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
    <section style={{ padding: "10px 0 2px" }}>
      <button
        type="button"
        onClick={onSelect}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        aria-label={HOME_SURPRISE.display}
        style={{
          width: "100%",
          minHeight: 54,
          border: `1px solid ${HOME_PURPLE}33`,
          borderRadius: 16,
          background: HOME_PURPLE_SOFT,
          color: "#4B32B0",
          cursor: "pointer",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: "0 2px 8px rgba(107, 77, 230, 0.08)",
          transform: pressed ? "scale(0.98)" : "scale(1)",
          transition: "transform 120ms ease",
        }}
      >
        <SparkleIcon size={18} color={HOME_PURPLE} />
        {HOME_SURPRISE.display}
      </button>
    </section>
  );
}
