"use client";

import React from "react";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { useDeckRecommendationReasons } from "@/_hooks/useDeckRecommendationReasons";
import { RecommendationCard } from "./RecommendationCard";
import { space } from "@/lib/designTokens";

type Props = {
  cards: HomeCard[];
  scenarioObject: ScenarioObject | null;
  onPlaceClick: (card: HomeCard, rank: number) => void;
  onNavigate: (card: HomeCard, rank: number) => void;
  onCall: (card: HomeCard, rank: number) => void;
};

export function RecommendationList({
  cards,
  scenarioObject,
  onPlaceClick,
  onNavigate,
  onCall,
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
          onCardClick={() => onPlaceClick(card, i)}
          onNavigate={() => onNavigate(card, i)}
          onCall={() => onCall(card, i)}
        />
      ))}
    </div>
  );
}
