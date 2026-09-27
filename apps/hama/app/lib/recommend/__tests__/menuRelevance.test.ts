import { describe, expect, it } from "vitest";
import { cardMatchesStrictFoodIntent, foodMenuMatchRaw } from "../foodIntentRanking";
import { matchMenuRelevance, strongTermsForMenu } from "../menuRelevance";
import { buildTopRecommendations, type BuildRecommendationsContext } from "../scoring";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";

function card(partial: Partial<HomeCard> & Pick<HomeCard, "id" | "name" | "category">): HomeCard {
  return {
    lat: 37.15,
    lng: 127.07,
    area: null,
    address: null,
    image_url: null,
    mood: [],
    tags: [],
    description: null,
    updated_at: null,
    with_kids: null,
    for_work: null,
    reservation_required: null,
    vegetarian_available: null,
    halal_available: null,
    price_level: null,
    ...partial,
  };
}

describe("menu relevance taxonomy", () => {
  it("분식 expands to 떡볶이/김밥 via shared synonym dictionary", () => {
    const terms = strongTermsForMenu("분식");
    expect(terms).toEqual(expect.arrayContaining(["떡볶이", "김밥", "라면", "순대"]));
  });

  it("떡볶이 store passes 분식 strict filter; pasta does not", () => {
    const tteok = card({
      id: "tteok",
      name: "옥이떡볶이",
      category: "restaurant",
      menu_keywords: ["떡볶이", "순대"],
    });
    const pasta = card({
      id: "pasta",
      name: "스트리트파스타",
      category: "restaurant",
      menu_keywords: ["파스타", "크림파스타"],
    });
    const parsed: Pick<ScenarioObject, "intentCategory" | "intentType" | "intentStrict" | "foodSubCategory" | "menuIntent" | "rawQuery"> = {
      intentType: "search_strict",
      intentCategory: "FOOD",
      menuIntent: ["분식"],
      rawQuery: "분식",
    };
    expect(cardMatchesStrictFoodIntent(tteok, parsed)).toBe(true);
    expect(cardMatchesStrictFoodIntent(pasta, parsed)).toBe(false);
    expect(matchMenuRelevance(tteok, ["분식"]).hasStrongHit).toBe(true);
    expect(matchMenuRelevance(pasta, ["분식"]).hasStrongHit).toBe(false);
  });

  it("갈비 name is a strong synonym of 고기", () => {
    const galbi = card({
      id: "galbi",
      name: "송도갈비",
      category: "restaurant",
      menu_keywords: ["갈비"],
    });
    const soup = card({
      id: "soup",
      name: "청수식당",
      category: "restaurant",
      menu_keywords: ["국밥"],
      tags: ["한식"],
    });
    expect(matchMenuRelevance(galbi, ["고기"]).tier).toMatch(/exact|synonym/);
    expect(matchMenuRelevance(soup, ["고기"]).hasStrongHit).toBe(false);
  });
});

describe("explicit menu ranking", () => {
  it("냉면 exact match ranks above a popular 국밥 house", () => {
    const naeng = card({
      id: "naeng",
      name: "평양냉면",
      category: "restaurant",
      menu_keywords: ["냉면", "물냉면"],
    });
    const soup = card({
      id: "soup",
      name: "돌탄순댓국",
      category: "restaurant",
      menu_keywords: ["순댓국", "국밥"],
      tags: ["한식"],
    });
    const so: ScenarioObject = {
      intentType: "search_strict",
      intentCategory: "FOOD",
      scenario: "generic",
      rawQuery: "냉면 땡겨",
      menuIntent: ["냉면"],
    };
    const ctx: BuildRecommendationsContext = {
      intent: "none",
      userLat: 37.15,
      userLng: 127.07,
      searchQuery: "냉면 땡겨",
      scenarioObject: so,
    };
    const out = buildTopRecommendations([soup, naeng], ctx);
    expect(out[0]?.card.id).toBe("naeng");
    expect(foodMenuMatchRaw(naeng, ["냉면"], null).hasStrongHit).toBe(true);
    expect(foodMenuMatchRaw(soup, ["냉면"], null).hasStrongHit).toBe(false);
  });
});
