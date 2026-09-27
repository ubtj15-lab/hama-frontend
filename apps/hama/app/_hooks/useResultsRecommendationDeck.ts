"use client";

import { useMemo } from "react";
import { useHomeCards } from "@/_hooks/useHomeCards";
import { usePlaceNameSearchResults } from "@/_hooks/usePlaceNameSearchResults";
import { explainPlaceNameSearchGate } from "@/lib/results/placeNameSearchIntent";
import { isDirectSearchModeQuery } from "@/lib/search/directSearch";
import type { IntentionType } from "@/lib/intention";
import type { NamedFoodPreset } from "@/lib/recommend/namedFoodPresets";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import type { UserProfile } from "@/lib/onboardingProfile";
import {
  buildResultsHomeCardsOptions,
  classifyPlaceSearchStatus,
  resolvePlaceSearchEnabled,
  resolveResultsLookupFlow,
} from "@/lib/results/resultsRecommendationDeck";

export function useResultsRecommendationDeck(input: {
  qRaw: string;
  hasNamedFoodPreset: boolean;
  isSoloSituationQuery: boolean;
  userLat: number | null | undefined;
  userLng: number | null | undefined;
  shuffleKey: number;
  intentForHomeCards: IntentionType;
  rankingBootstrapReady: boolean;
  recentExcludeIds: string[];
  rejectedMainPickIds: string[];
  repeatAvoidPlaceIds: string[];
  profileOverride: Partial<UserProfile> | null;
  relaxPersonalRules: boolean;
  searchQuery: string | null;
  scenarioObject: ScenarioObject | undefined;
  courseIdParam: string;
  tonkatsuRecommendDisabled: boolean;
  skipFetchExtra?: boolean;
  retainCardsOnSkip?: boolean;
  explicitIntent: string | null;
  explicitCategory: string | null;
  explicitMode: string | null;
  namedFoodPreset: NamedFoodPreset | null;
}) {
  const placeNameGate = useMemo(() => explainPlaceNameSearchGate(input.qRaw), [input.qRaw]);
  const directSearchMode = useMemo(() => isDirectSearchModeQuery(input.qRaw), [input.qRaw]);
  const placeSearchEnabled = resolvePlaceSearchEnabled({
    directSearchMode,
    hasNamedFoodPreset: input.hasNamedFoodPreset,
    isSoloSituationQuery: input.isSoloSituationQuery,
    placeNameGateEnabled: placeNameGate.enabled,
  });
  const {
    items: placeHits,
    loading: placeSearchLoading,
    meta: placeSearchMeta,
  } = usePlaceNameSearchResults(input.qRaw, placeSearchEnabled, input.userLat, input.userLng);
  const flow = resolveResultsLookupFlow({
    placeSearchEnabled,
    placeSearchLoading,
    placeHitCount: placeHits.length,
    hasNamedFoodPreset: input.hasNamedFoodPreset,
  });
  const home = useHomeCards(
    "all",
    input.shuffleKey,
    input.intentForHomeCards,
    buildResultsHomeCardsOptions({
      userLat: input.userLat,
      userLng: input.userLng,
      recentExcludeIds: input.recentExcludeIds,
      rejectedMainPickIds: input.rejectedMainPickIds,
      sessionRepeatAvoidIds: input.repeatAvoidPlaceIds,
      profileOverride: input.profileOverride,
      relaxPersonalRules: input.relaxPersonalRules,
      searchQuery: input.searchQuery,
      scenarioObject: input.scenarioObject,
      rankingBootstrapReady: input.rankingBootstrapReady,
      deferRecForPlaceLookup: flow.deferRecForPlaceLookup,
      courseIdParam: input.courseIdParam,
      tonkatsuRecommendDisabled: input.tonkatsuRecommendDisabled,
      skipFetchExtra: input.skipFetchExtra,
      retainCardsOnSkip: input.retainCardsOnSkip,
      explicitIntent: input.explicitIntent,
      explicitCategory: input.explicitCategory,
      explicitMode: input.explicitMode,
      namedFoodPreset: input.namedFoodPreset,
    })
  );
  const placeStatus = classifyPlaceSearchStatus(placeSearchMeta);
  const bootstrapBusy = !input.rankingBootstrapReady;
  return {
    placeNameGate,
    directSearchMode,
    placeSearchEnabled,
    placeHits,
    placeSearchLoading,
    placeSearchMeta,
    ...flow,
    ...home,
    ...placeStatus,
    bootstrapBusy,
    pageBusy: bootstrapBusy || home.isLoading,
  };
}
