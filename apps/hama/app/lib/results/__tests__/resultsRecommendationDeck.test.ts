import { describe, expect, it } from "vitest";
import type { HomeCard } from "@/lib/storeTypes";
import { filterCardsByNamedRegion } from "@/lib/conversation/namedRegion";
import { storeCategoryMatchesIntentCategory } from "@/lib/scenarioEngine/intentClassification";
import { resolveSearchQueryForHomeCards } from "../resultsQueryRouting";
import {
  assembleResultsCardLists,
  buildResultsHomeCardsOptions,
  classifyPlaceSearchStatus,
  resolvePlaceSearchEnabled,
  resolveResultsLookupFlow,
} from "../resultsRecommendationDeck";

function card(id: string, extra: Partial<HomeCard> = {}): HomeCard {
  return { id, name: id, category: "restaurant", ...extra };
}

const fetchBase = {
  userLat: 37.1,
  userLng: 127.0,
  recentExcludeIds: [],
  rejectedMainPickIds: [],
  sessionRepeatAvoidIds: [],
  profileOverride: null,
  relaxPersonalRules: false,
  searchQuery: "식당",
  scenarioObject: undefined,
  rankingBootstrapReady: true,
  deferRecForPlaceLookup: false,
  courseIdParam: "",
  tonkatsuRecommendDisabled: false,
  explicitIntent: "food_general",
  explicitCategory: "restaurant",
  explicitMode: "single",
  namedFoodPreset: null,
};

describe("results recommendation deck", () => {
  it("keeps general food cards in ranking order", () => {
    const cards = [card("a"), card("b"), card("c")];
    const lists = assembleResultsCardLists({
      cards,
      placeHits: [],
      directSearchMode: false,
      beautyUrlFinalGuard: false,
      cultureUrlFinalGuard: false,
      courseRestoreFailed: false,
      isCourseFixedResults: false,
      courseFixedCards: null,
    });
    expect(lists.primaryListCards.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(lists.primaryRecommendationCards).toBe(cards);
    expect(resolveSearchQueryForHomeCards({
      qRaw: "맛집",
      explicitCategory: null,
      isSoloSituationQuery: false,
      hasNamedFoodPreset: false,
    })).toBe("맛집");
  });

  it("applies the conversational region and activity narrow without reordering survivors", () => {
    const cards = [
      card("play-dongtan", { category: "activity", address: "경기도 화성시 동탄대로 1" }),
      card("food-dongtan", { category: "restaurant", address: "경기도 화성시 동탄대로 2" }),
      card("play-osan", { category: "activity", address: "경기도 오산시 오산로 3" }),
    ];
    const shared = {
      cards,
      placeHits: [] as HomeCard[],
      directSearchMode: false,
      beautyUrlFinalGuard: false,
      cultureUrlFinalGuard: false,
      courseRestoreFailed: false,
      isCourseFixedResults: false,
      courseFixedCards: null,
    };
    const standalone = assembleResultsCardLists(shared);
    const conversational = assembleResultsCardLists({
      ...shared,
      narrowPrimaryList: (list) => {
        const regional = filterCardsByNamedRegion(list, "동탄");
        return regional.filter((item) => storeCategoryMatchesIntentCategory(item, "ACTIVITY"));
      },
    });
    expect(standalone.primaryListCards.map((item) => item.id)).toEqual([
      "play-dongtan",
      "food-dongtan",
      "play-osan",
    ]);
    expect(conversational.primaryListCards.map((item) => item.id)).toEqual(["play-dongtan"]);
  });

  it("keeps a museum query on recommendation cards when name search has no hits", () => {
    expect(resolveSearchQueryForHomeCards({
      qRaw: "박물관",
      explicitCategory: null,
      isSoloSituationQuery: false,
      hasNamedFoodPreset: false,
    })).toBe("박물관");
    const cards = [card("museum-a"), card("museum-b")];
    const flow = resolveResultsLookupFlow({
      placeSearchEnabled: true,
      placeSearchLoading: false,
      placeHitCount: 0,
      hasNamedFoodPreset: false,
    });
    expect(flow.showNameSearch).toBe(false);
    expect(flow.resultsFlowMode).toBe("recommendation");
    const lists = assembleResultsCardLists({
      cards,
      placeHits: [],
      directSearchMode: false,
      beautyUrlFinalGuard: false,
      cultureUrlFinalGuard: false,
      courseRestoreFailed: false,
      isCourseFixedResults: false,
      courseFixedCards: null,
    });
    expect(lists.primaryListCards.map((item) => item.id)).toEqual(["museum-a", "museum-b"]);
  });

  it("uses place-name hits as the primary list and keeps their order", () => {
    const hits = [card("hit-1"), card("hit-2"), card("hit-3")];
    const cards = [card("hit-2"), card("pool")];
    const lists = assembleResultsCardLists({
      cards,
      placeHits: hits,
      directSearchMode: true,
      beautyUrlFinalGuard: false,
      cultureUrlFinalGuard: false,
      courseRestoreFailed: false,
      isCourseFixedResults: false,
      courseFixedCards: null,
    });
    expect(lists.primaryListCards.map((item) => item.id)).toEqual(["hit-1", "hit-2", "hit-3"]);
    expect(lists.secondaryRecommendCards.map((item) => item.id)).toEqual(["pool"]);
    expect(resolveResultsLookupFlow({
      placeSearchEnabled: true,
      placeSearchLoading: false,
      placeHitCount: hits.length,
      hasNamedFoodPreset: false,
    }).showNameSearch).toBe(true);
  });

  it("keeps follow-up meal cards by skipping a new fetch without discarding the previous deck", () => {
    const options = buildResultsHomeCardsOptions({
      ...fetchBase,
      searchQuery: "식당",
      skipFetchExtra: true,
      retainCardsOnSkip: true,
    });
    expect(options.skipFetch).toBe(true);
    expect(options.retainCardsOnSkip).toBe(true);
    expect(options.searchQuery).toBe("식당");
    const kept = [card("play-1"), card("play-2")];
    const lists = assembleResultsCardLists({
      cards: kept,
      placeHits: [],
      directSearchMode: false,
      beautyUrlFinalGuard: false,
      cultureUrlFinalGuard: false,
      courseRestoreFailed: false,
      isCourseFixedResults: false,
      courseFixedCards: null,
    });
    expect(lists.primaryListCards.map((item) => item.id)).toEqual(["play-1", "play-2"]);
  });

  it("restores a fixed course deck in stop order and blocks a failed restore", () => {
    const fixed = [card("stop-2"), card("stop-1")];
    const restored = assembleResultsCardLists({
      cards: [card("live")],
      placeHits: [],
      directSearchMode: false,
      beautyUrlFinalGuard: false,
      cultureUrlFinalGuard: false,
      courseRestoreFailed: false,
      isCourseFixedResults: true,
      courseFixedCards: fixed,
    });
    expect(restored.primaryListCards.map((item) => item.id)).toEqual(["stop-2", "stop-1"]);
    const failed = assembleResultsCardLists({
      cards: [card("live")],
      placeHits: [],
      directSearchMode: false,
      beautyUrlFinalGuard: false,
      cultureUrlFinalGuard: false,
      courseRestoreFailed: true,
      isCourseFixedResults: false,
      courseFixedCards: null,
    });
    expect(failed.primaryListCards).toEqual([]);
    expect(buildResultsHomeCardsOptions({ ...fetchBase, courseIdParam: "course-1" }).skipFetch).toBe(true);
  });

  it("separates a partial name-search failure from a suppression block", () => {
    expect(classifyPlaceSearchStatus({ apiOk: false, error: "query_failed" })).toEqual({
      nameSearchBlocked: false,
      nameSearchFailed: true,
    });
    expect(classifyPlaceSearchStatus({ apiOk: false, error: "suppression_unavailable" })).toEqual({
      nameSearchBlocked: true,
      nameSearchFailed: false,
    });
    expect(classifyPlaceSearchStatus(null)).toEqual({
      nameSearchBlocked: false,
      nameSearchFailed: false,
    });
    expect(classifyPlaceSearchStatus({ apiOk: true })).toEqual({
      nameSearchBlocked: false,
      nameSearchFailed: false,
    });
    const cards = [card("kept")];
    const lists = assembleResultsCardLists({
      cards,
      placeHits: [],
      directSearchMode: false,
      beautyUrlFinalGuard: false,
      cultureUrlFinalGuard: false,
      courseRestoreFailed: false,
      isCourseFixedResults: false,
      courseFixedCards: null,
    });
    expect(lists.primaryListCards.map((item) => item.id)).toEqual(["kept"]);
    const suppressed = assembleResultsCardLists({
      cards: [],
      placeHits: [],
      directSearchMode: false,
      beautyUrlFinalGuard: false,
      cultureUrlFinalGuard: false,
      courseRestoreFailed: false,
      isCourseFixedResults: false,
      courseFixedCards: null,
    });
    expect(suppressed.primaryListCards).toEqual([]);
    expect(suppressed.secondaryListCards).toEqual([]);
  });

  it("does not start place search for a solo situation that is not a direct query", () => {
    expect(resolvePlaceSearchEnabled({
      directSearchMode: false,
      hasNamedFoodPreset: false,
      isSoloSituationQuery: true,
      placeNameGateEnabled: true,
    })).toBe(false);
    expect(resolvePlaceSearchEnabled({
      directSearchMode: true,
      hasNamedFoodPreset: true,
      isSoloSituationQuery: true,
      placeNameGateEnabled: false,
    })).toBe(true);
  });
});
