import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import type { NamedFoodPreset } from "@/lib/recommend/namedFoodPresets";
import type { UseHomeCardsOptions } from "@/_hooks/useHomeCards";
import type { UserProfile } from "@/lib/onboardingProfile";
import { passesBeautyIndustryWhitelist, passesCultureIndustryWhitelist } from "@/lib/hamaResultCategoryCanonical";

export function resolvePlaceSearchEnabled(input: {
  directSearchMode: boolean;
  hasNamedFoodPreset: boolean;
  isSoloSituationQuery: boolean;
  placeNameGateEnabled: boolean;
}): boolean {
  return (
    (input.directSearchMode || (!input.hasNamedFoodPreset && !input.isSoloSituationQuery)) &&
    (input.directSearchMode || input.placeNameGateEnabled)
  );
}

export function resolveResultsLookupFlow(input: {
  placeSearchEnabled: boolean;
  placeSearchLoading: boolean;
  placeHitCount: number;
  hasNamedFoodPreset: boolean;
}): {
  deferRecForPlaceLookup: boolean;
  placeLookupDone: boolean;
  placeLookupBusy: boolean;
  showNameSearch: boolean;
  placeSearchDominant: boolean;
  resultsFlowMode: "place_search" | "recommendation";
} {
  const placeLookupDone = !input.placeSearchEnabled || !input.placeSearchLoading;
  const placeLookupBusy = input.placeSearchEnabled && input.placeSearchLoading;
  const showNameSearch = input.placeSearchEnabled && placeLookupDone && input.placeHitCount > 0;
  return {
    deferRecForPlaceLookup: input.hasNamedFoodPreset ? false : placeLookupBusy,
    placeLookupDone,
    placeLookupBusy,
    showNameSearch,
    placeSearchDominant: showNameSearch,
    resultsFlowMode: showNameSearch ? "place_search" : "recommendation",
  };
}

export const RECOMMEND_DATA_UNAVAILABLE_MESSAGE =
  "추천 정보를 불러오지 못해서 결과를 보여드리지 않았어요. 잠시 후 다시 시도해 주세요.";

export type ResultsDataNoticeInput = {
  recommendationBlocked: boolean;
  recommendationLoadFailed: boolean;
  nameSearchBlocked: boolean;
  nameSearchFailed: boolean;
  verifiedRecommendationCount: number;
  verifiedPlaceHitCount: number;
  foodRecommendationBlocked?: boolean;
  foodRecommendationLoadFailed?: boolean;
  baseShowEmptyState: boolean;
  forceShowListByCards: boolean;
};

export type ResultsDataNotice = {
  showSuppressionError: boolean;
  showFetchError: boolean;
  showEmptyState: boolean;
  showRecommendationCards: boolean;
  showPlaceHits: boolean;
};

/**
 * Partial verified results stay visible.
 * A suppression failure hides that channel, and an all-channel failure is not an empty success.
 */
export function resolveResultsDataNotice(input: ResultsDataNoticeInput): ResultsDataNotice {
  const verifiedRecommendationCount = input.recommendationBlocked ? 0 : input.verifiedRecommendationCount;
  const verifiedPlaceHitCount = input.nameSearchBlocked ? 0 : input.verifiedPlaceHitCount;
  const verifiedCount = verifiedRecommendationCount + verifiedPlaceHitCount;
  const mainBlocked = input.recommendationBlocked || input.nameSearchBlocked;
  const mainFailed = input.recommendationLoadFailed || input.nameSearchFailed;
  const foodBlocked = Boolean(input.foodRecommendationBlocked);
  const foodFailed = Boolean(input.foodRecommendationLoadFailed);
  const showSuppressionError = (mainBlocked && verifiedCount === 0) || foodBlocked;
  const showFetchError =
    !showSuppressionError && ((mainFailed && verifiedCount === 0 && !mainBlocked) || foodFailed);
  return {
    showSuppressionError,
    showFetchError,
    showEmptyState:
      !showSuppressionError &&
      !showFetchError &&
      !foodBlocked &&
      !foodFailed &&
      !input.forceShowListByCards &&
      input.baseShowEmptyState &&
      verifiedCount === 0,
    showRecommendationCards: !input.recommendationBlocked,
    showPlaceHits: !input.nameSearchBlocked,
  };
}

export function classifyPlaceSearchStatus(
  meta: { apiOk: boolean; error?: string } | null
): { nameSearchBlocked: boolean; nameSearchFailed: boolean } {
  return {
    nameSearchBlocked: meta?.error === "suppression_unavailable",
    nameSearchFailed: Boolean(meta && meta.apiOk === false && meta.error !== "suppression_unavailable"),
  };
}

export function buildResultsHomeCardsOptions(input: {
  userLat: number | null | undefined;
  userLng: number | null | undefined;
  recentExcludeIds: string[];
  rejectedMainPickIds: string[];
  sessionRepeatAvoidIds: string[];
  profileOverride: Partial<UserProfile> | null;
  relaxPersonalRules: boolean;
  searchQuery: string | null;
  scenarioObject: ScenarioObject | undefined;
  rankingBootstrapReady: boolean;
  deferRecForPlaceLookup: boolean;
  courseIdParam: string;
  tonkatsuRecommendDisabled: boolean;
  skipFetchExtra?: boolean;
  retainCardsOnSkip?: boolean;
  explicitIntent: string | null;
  explicitCategory: string | null;
  explicitMode: string | null;
  namedFoodPreset: NamedFoodPreset | null;
}): UseHomeCardsOptions {
  return {
    userLat: input.userLat ?? null,
    userLng: input.userLng ?? null,
    excludeStoreIds: input.recentExcludeIds,
    rejectedMainPickIds: input.rejectedMainPickIds,
    repeatAvoidPlaceIds: input.sessionRepeatAvoidIds,
    profileOverride: input.profileOverride,
    relaxPersonalRules: input.relaxPersonalRules,
    searchQuery: input.searchQuery,
    scenarioObject: input.scenarioObject,
    deferRanking: !input.rankingBootstrapReady || input.deferRecForPlaceLookup,
    skipFetch: Boolean(input.courseIdParam) || input.tonkatsuRecommendDisabled || Boolean(input.skipFetchExtra),
    retainCardsOnSkip: Boolean(input.retainCardsOnSkip),
    explicitIntent: input.explicitIntent,
    explicitCategory: input.explicitCategory,
    explicitMode: input.explicitMode,
    namedFoodPreset: input.namedFoodPreset ?? undefined,
    recommendedDeckCap: input.namedFoodPreset ? 5 : undefined,
  };
}

function applyIndustryWhitelist(
  cards: HomeCard[],
  beauty: boolean,
  culture: boolean
): HomeCard[] {
  if (beauty) {
    const whitelisted = cards.filter((card) => passesBeautyIndustryWhitelist(card));
    return whitelisted.length > 0 ? whitelisted : cards;
  }
  if (culture) {
    const whitelisted = cards.filter((card) => passesCultureIndustryWhitelist(card));
    return whitelisted.length > 0 ? whitelisted : cards;
  }
  return cards;
}

export function assembleResultsCardLists(input: {
  cards: HomeCard[];
  placeHits: HomeCard[];
  directSearchMode: boolean;
  beautyUrlFinalGuard: boolean;
  cultureUrlFinalGuard: boolean;
  courseRestoreFailed: boolean;
  isCourseFixedResults: boolean;
  courseFixedCards: HomeCard[] | null;
  narrowPrimaryList?: (cards: HomeCard[]) => HomeCard[];
}): {
  directSearchPrimaryCards: HomeCard[] | null;
  primaryRecommendationCards: HomeCard[];
  secondaryRecommendCards: HomeCard[];
  primaryListCards: HomeCard[];
  secondaryListCards: HomeCard[];
} {
  const placeHitIds = new Set(input.placeHits.map((card) => card.id));
  const secondaryRecommendCards = input.beautyUrlFinalGuard
    ? input.cards
    : input.cards.filter((card) => !placeHitIds.has(card.id));
  const directSearchPrimaryCards =
    input.directSearchMode && input.placeHits.length > 0 ? input.placeHits.slice(0, 12) : null;
  const primaryRecommendationCards = input.beautyUrlFinalGuard
    ? input.cards
    : directSearchPrimaryCards ??
      (input.courseRestoreFailed
        ? []
        : input.isCourseFixedResults && input.courseFixedCards
          ? input.courseFixedCards
          : input.cards);
  const whitelistedPrimary = applyIndustryWhitelist(
    primaryRecommendationCards,
    input.beautyUrlFinalGuard,
    input.cultureUrlFinalGuard
  );
  return {
    directSearchPrimaryCards,
    primaryRecommendationCards,
    secondaryRecommendCards,
    primaryListCards: input.narrowPrimaryList ? input.narrowPrimaryList(whitelistedPrimary) : whitelistedPrimary,
    secondaryListCards: applyIndustryWhitelist(
      secondaryRecommendCards,
      input.beautyUrlFinalGuard,
      input.cultureUrlFinalGuard
    ),
  };
}
