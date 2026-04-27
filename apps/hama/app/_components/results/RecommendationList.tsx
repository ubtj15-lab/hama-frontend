"use client";

import React from "react";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { useDeckRecommendationReasons } from "@/_hooks/useDeckRecommendationReasons";
import { RecommendationCard } from "./RecommendationCard";
import { space } from "@/lib/designTokens";
import type { LogRecommendationEventInput } from "@/lib/analytics/types";

type Props = {
  cards: HomeCard[];
  scenarioObject: ScenarioObject | null;
  onPlaceClick: (card: HomeCard, rank: number) => void;
  onNavigate: (card: HomeCard, rank: number) => void;
  onCall: (card: HomeCard, rank: number) => void;
  analyticsV2Click?: LogRecommendationEventInput["analytics_v2"];
  /** 메인 카드 아래 — 후보 부족·재추천 등 */
  showSoftFallbackCopy?: boolean;
};

export function RecommendationList({
  cards,
  scenarioObject,
  onPlaceClick,
  onNavigate,
  onCall,
  analyticsV2Click,
  showSoftFallbackCopy = false,
}: Props) {
  const slice = cards.slice(0, 3);
  const deckReasons = useDeckRecommendationReasons(cards, scenarioObject);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.card }}>
      {slice.map((card, i) => (
        <RecommendationCard
          key={card.id}
          card={card}
          rank={i}
          scenarioObject={scenarioObject}
          reason={deckReasons[i]}
          showSoftFallbackCopy={showSoftFallbackCopy}
          analyticsV2Click={analyticsV2Click}
          onCardClick={() => onPlaceClick(card, i)}
          onNavigate={() => onNavigate(card, i)}
          onCall={() => onCall(card, i)}
        />
      ))}
      {slice.length > 0 ? (
        <div
          style={{
            borderRadius: 999,
            background: "rgba(255,255,255,0.7)",
            border: "1px solid #E5E7EB",
            color: "#6B7280",
            fontSize: 13,
            fontWeight: 700,
            padding: "10px 14px",
          }}
        >
          ⓘ 근처 실제 매장 기준으로 추천했어요. 상황에 따라 혼잡도는 달라질 수 있어요.
        </div>
      ) : null}
    </div>
  );
}
