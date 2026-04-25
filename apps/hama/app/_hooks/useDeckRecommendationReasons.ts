"use client";

import { useMemo } from "react";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import {
  buildRecommendationReason,
  getClientTimeOfDay,
  type RecommendationReasonBlock,
} from "@/lib/recommend/buildRecommendationReason";
import { scenarioRankKeyForRecommendationCopy } from "@/lib/scenarioEngine/scenarioRankBridge";
import { RECOMMEND_DECK_SIZE } from "@/lib/recommend/recommendConstants";

/**
 * 추천 덱 — headline/subline 이 서로 겹치지 않도록 used 세트로 variation.
 */
export function useDeckRecommendationReasons(
  cards: HomeCard[],
  scenarioObject: ScenarioObject | null
): RecommendationReasonBlock[] {
  return useMemo(() => {
    const uh = new Set<string>();
    const us = new Set<string>();
    const requestedScenario = scenarioRankKeyForRecommendationCopy(scenarioObject);
    const roles = ["main", "near", "alt"] as const;
    return cards.slice(0, RECOMMEND_DECK_SIZE).map((card, i) =>
      buildRecommendationReason(card, {
        deckSlot: i,
        deckRole: roles[i] ?? "main",
        timeOfDay: getClientTimeOfDay(),
        requestedScenario,
        usedHeadlines: uh,
        usedSublines: us,
      })
    );
  }, [cards, scenarioObject]);
}
