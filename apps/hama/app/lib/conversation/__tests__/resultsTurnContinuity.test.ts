import { describe, expect, it } from "vitest";
import type { HomeCard } from "@/lib/storeTypes";
import { processConversationTurn } from "../processTurn";
import { detectLinkedFoodPurpose } from "../linkedPurpose";
import { resolveSearchQueryForHomeCards } from "@/lib/results/resultsQueryRouting";
import { buildResultsHomeCardsOptions } from "@/lib/results/resultsRecommendationDeck";

function card(id: string): HomeCard {
  return { id, name: id, category: "activity" };
}

const fetchBase = {
  userLat: null,
  userLng: null,
  recentExcludeIds: [],
  rejectedMainPickIds: [],
  sessionRepeatAvoidIds: [],
  profileOverride: null,
  relaxPersonalRules: false,
  scenarioObject: undefined,
  rankingBootstrapReady: true,
  deferRecForPlaceLookup: false,
  courseIdParam: "",
  tonkatsuRecommendDisabled: false,
  explicitIntent: null,
  explicitCategory: null,
  explicitMode: null,
  namedFoodPreset: null,
};

describe("results conversation continuity", () => {
  it("keeps the Dongtan play list and adds a nearby meal without replacing the search with history", () => {
    const firstUtterance = "동탄에서 아이들이랑 갈 만한 곳 찾아줘";
    const secondUtterance = "그 근처에 밥 먹을 곳도 있어?";
    const first = processConversationTurn(firstUtterance, null, { persist: false, turnId: "t1" });
    const withCards = {
      ...first,
      lastRecommendations: { placeIds: ["play-1"], cards: [card("play-1")] },
    };
    const second = processConversationTurn(secondUtterance, withCards, { persist: false, turnId: "t2" });

    expect(resolveSearchQueryForHomeCards({
      qRaw: secondUtterance,
      explicitCategory: null,
      isSoloSituationQuery: false,
      hasNamedFoodPreset: false,
    })).toBe(secondUtterance);
    expect(second.cumulativeText).not.toBe(secondUtterance);
    expect(second.currentIntent.region).toBe("동탄");
    expect(detectLinkedFoodPurpose(secondUtterance)).toBe(true);
    expect(second.linkedPurposes?.some((item) => item.intentCategory === "FOOD")).toBe(true);
    expect(second.frozenPlayCards?.map((item) => item.id)).toEqual(["play-1"]);

    const kept = buildResultsHomeCardsOptions({
      ...fetchBase,
      searchQuery: "식당",
      skipFetchExtra: true,
      retainCardsOnSkip: true,
    });
    expect(kept.skipFetch).toBe(true);
    expect(kept.retainCardsOnSkip).toBe(true);
  });

  it("treats a corrected Osan cafe request as a new search instead of a kept meal", () => {
    const firstUtterance = "카페 찾아줘";
    const secondUtterance = "아니, 오산에서 조용한 카페";
    const first = processConversationTurn(firstUtterance, null, { persist: false, turnId: "c1" });
    const withCards = {
      ...first,
      lastRecommendations: { placeIds: ["cafe-1"], cards: [card("cafe-1")] },
    };
    const second = processConversationTurn(secondUtterance, withCards, { persist: false, turnId: "c2" });

    expect(resolveSearchQueryForHomeCards({
      qRaw: secondUtterance,
      explicitCategory: null,
      isSoloSituationQuery: false,
      hasNamedFoodPreset: false,
    })).toBe(secondUtterance);
    expect(detectLinkedFoodPurpose(secondUtterance)).toBe(false);
    expect(second.frozenPlayCards).toBeUndefined();
    expect(second.currentIntent.region).toBe("오산");
    expect(second.currentIntent.intentCategory).toBe("CAFE");

    const fresh = buildResultsHomeCardsOptions({
      ...fetchBase,
      searchQuery: secondUtterance,
    });
    expect(fresh.skipFetch).toBe(false);
    expect(fresh.retainCardsOnSkip).toBe(false);
  });
});
