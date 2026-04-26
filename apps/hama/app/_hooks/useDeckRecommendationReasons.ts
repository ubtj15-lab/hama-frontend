"use client";

import { useMemo } from "react";
import { useEffect, useState } from "react";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import {
  buildRecommendationReason,
  getClientTimeOfDay,
  type RecommendationReasonBlock,
} from "@/lib/recommend/buildRecommendationReason";
import { scenarioRankKeyForRecommendationCopy } from "@/lib/scenarioEngine/scenarioRankBridge";
import { RECOMMEND_DECK_SIZE } from "@/lib/recommend/recommendConstants";
import { parseUserProfile } from "@/lib/onboardingProfile";
import type { RecommendScenarioKey } from "@/lib/recommend/scenarioWeights";

/**
 * 추천 덱 — headline/subline 이 서로 겹치지 않도록 used 세트로 variation.
 */
export function useDeckRecommendationReasons(
  cards: HomeCard[],
  scenarioObject: ScenarioObject | null
): RecommendationReasonBlock[] {
  const [profileScenario, setProfileScenario] = useState<RecommendScenarioKey | undefined>(undefined);
  const [profileCompanions, setProfileCompanions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/users/me/profile", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const profile = parseUserProfile(json?.user_profile);
        if (cancelled) return;
        setProfileCompanions(profile.companions ?? []);
        if (profile.companions.includes("가족")) {
          setProfileScenario("family");
          return;
        }
        if (profile.companions.includes("둘이서")) {
          setProfileScenario("date");
          return;
        }
        if (profile.companions.includes("혼자")) {
          setProfileScenario("solo");
          return;
        }
        if (profile.companions.includes("친구")) {
          setProfileScenario("group");
          return;
        }
        setProfileScenario(undefined);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const uh = new Set<string>();
    const us = new Set<string>();
    const requestedScenario = scenarioRankKeyForRecommendationCopy(scenarioObject) ?? profileScenario;
    const roles = ["main", "near", "alt"] as const;
    return cards.slice(0, RECOMMEND_DECK_SIZE).map((card, i) =>
      buildRecommendationReason(card, {
        deckSlot: i,
        deckRole: roles[i] ?? "main",
        timeOfDay: getClientTimeOfDay(),
        requestedScenario,
        profileCompanions,
        usedHeadlines: uh,
        usedSublines: us,
      })
    );
  }, [cards, scenarioObject, profileScenario, profileCompanions]);
}
