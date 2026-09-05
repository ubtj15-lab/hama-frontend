import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { classifyIntent, detectStrictCategory } from "@/lib/scenarioEngine/intentClassification";
import { classifyDiscoveryQuery } from "@/lib/recommend/discoveryRole";
import { buildTopRecommendations } from "@/lib/recommend/scoring";
import { scenarioObjectToIntention } from "@/lib/scenarioEngine/scenarioRankBridge";
import { DEFAULT_USER_PROFILE } from "@/lib/onboardingProfile";
import {
  collapseGenericFoodRealWorldDuplicatesWithinExactFinalScoreTies,
  getConservativeRealWorldPlaceKeyForGenericFood,
  isGenericFoodScoreTieBreakQuery,
} from "@/lib/recommend/genericFoodScoreTieBreak";
import {
  hasStrongerDiningOutOverrideContext,
  isNeutralGenericDiningOutQuery,
} from "../genericDiningOut";
import type { HomeCard } from "@/lib/storeTypes";

function card(partial: Partial<HomeCard> & { id: string; name: string; category: string }): HomeCard {
  return {
    lat: 37.1498,
    lng: 127.0772,
    address: "경기도 오산시 테스트",
    ...partial,
  };
}

describe("generic dining-out routing V1", () => {
  it("A-C: neutral 외식 inflections use FOOD / search_strict", () => {
    for (const q of ["오늘 외식할 곳", "외식하러 갈 곳", "저녁 외식할 곳", "오늘 외식할까?", "외식할 식당 골라줘"]) {
      expect(isNeutralGenericDiningOutQuery(q)).toBe(true);
      expect(detectStrictCategory(q)).toBe("FOOD");
      expect(classifyIntent(q)).toBe("search_strict");
      const parsed = parseScenarioIntent(q);
      expect(parsed.intentType).toBe("search_strict");
      expect(parsed.intentCategory).toBe("FOOD");
      expect(classifyDiscoveryQuery(q, parsed).isDiscovery).toBe(false);
    }
  });

  it("D-E: FOOD-07 mixed activity/cafe backups do not fill the deck", () => {
    const q = "오늘 외식할 곳";
    const parsed = parseScenarioIntent(q);
    const deck = buildTopRecommendations(
      [
        card({ id: "r1", name: "역대짬뽕", category: "restaurant", distanceKm: 0.4 }),
        card({ id: "a1", name: "느루정원", category: "activity", distanceKm: 0.17 }),
        card({ id: "c1", name: "이디야커피 오산궐동점", category: "cafe", distanceKm: 2.3 }),
        card({ id: "r2", name: "청수식당", category: "restaurant", distanceKm: 0.36 }),
      ],
      {
        intent: scenarioObjectToIntention(parsed),
        userLat: 37.1498,
        userLng: 127.0772,
        searchQuery: q,
        scenarioObject: parsed,
        userProfile: { ...DEFAULT_USER_PROFILE },
      }
    );
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((x) => String(x.card.category).toLowerCase() === "restaurant")).toBe(true);
    expect(deck.some((x) => x.card.name === "느루정원")).toBe(false);
    expect(deck.some((x) => String(x.card.name).includes("이디야"))).toBe(false);
  });

  it("F-G: generic FOOD tie-break + real-world duplicate collapse apply to dining-out", () => {
    const q = "오늘 외식할 곳";
    const parsed = parseScenarioIntent(q);
    expect(isGenericFoodScoreTieBreakQuery(q, parsed)).toBe(true);

    const address = "경기도 오산시 성호대로 130 204호";
    const a: HomeCard = {
      id: "sushi-a",
      name: "특별한초밥 오산점",
      category: "restaurant",
      lat: 37.1484737560528,
      lng: 127.075804685742,
      address,
    };
    const b: HomeCard = {
      id: "sushi-b",
      name: "특별한초밥 오산점",
      category: "restaurant",
      lat: 37.1484737560528,
      lng: 127.075804685742,
      address,
    };
    const collapsed = collapseGenericFoodRealWorldDuplicatesWithinExactFinalScoreTies(
      [
        { card: a, breakdown: { finalScore: 53.58163265306123 } },
        { card: b, breakdown: { finalScore: 53.58163265306123 } },
      ],
      getConservativeRealWorldPlaceKeyForGenericFood
    );
    expect(collapsed).toHaveLength(1);
  });

  it("H-K: family / kids / DATE / RELAX context is not overwritten to generic FOOD", () => {
    const family = parseScenarioIntent("가족 외식");
    expect(isNeutralGenericDiningOutQuery("가족 외식")).toBe(false);
    expect(family.scenario).toBe("family");
    expect(family.intentCategory === "FOOD" && family.intentType === "search_strict").toBe(false);

    const kids = parseScenarioIntent("아이랑 외식할 곳");
    expect(hasStrongerDiningOutOverrideContext("아이랑 외식할 곳")).toBe(true);
    expect(isNeutralGenericDiningOutQuery("아이랑 외식할 곳")).toBe(false);
    expect(kids.withKids === true || kids.scenario === "family_kids" || kids.scenario === "family").toBe(true);
    expect(isGenericFoodScoreTieBreakQuery("아이랑 외식할 곳", kids)).toBe(false);

    const date = parseScenarioIntent("데이트하면서 외식할 곳");
    expect(isNeutralGenericDiningOutQuery("데이트하면서 외식할 곳")).toBe(false);
    expect(date.scenario).toBe("date");
    expect(date.intentType === "search_strict" && date.intentCategory === "FOOD").toBe(false);
    expect(classifyDiscoveryQuery("데이트하면서 외식할 곳", date).role).not.toBe("RELAX");

    const relaxQ = "조용히 쉬다가 외식할 곳";
    expect(isNeutralGenericDiningOutQuery(relaxQ)).toBe(false);
    const relax = parseScenarioIntent(relaxQ);
    expect(relax.intentType === "search_strict" && relax.intentCategory === "FOOD").toBe(false);
    expect(isGenericFoodScoreTieBreakQuery(relaxQ, relax)).toBe(false);
  });
});
