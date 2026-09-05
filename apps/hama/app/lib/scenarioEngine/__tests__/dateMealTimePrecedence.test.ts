import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { classifyIntent, detectStrictCategory } from "@/lib/scenarioEngine/intentClassification";
import { classifyDiscoveryQuery } from "@/lib/recommend/discoveryRole";
import { buildTopRecommendations } from "@/lib/recommend/scoring";
import { scenarioObjectToIntention } from "@/lib/scenarioEngine/scenarioRankBridge";
import { DEFAULT_USER_PROFILE } from "@/lib/onboardingProfile";
import {
  applyRepeatAvoidanceToOrderedDeck,
  shouldApplyDateRepeatAvoidance,
  shouldApplyHomeSituationRepeatAvoidance,
} from "@/lib/recommend/dateRepeatAvoidance";
import { isExplicitDateMealTimeOnlyFoodLeak } from "../dateMealTimePrecedence";
import { runIntentClassificationChecks } from "../intentClassification.scenarios";
import { isNeutralGenericDiningOutQuery } from "../genericDiningOut";
import type { HomeCard } from "@/lib/storeTypes";

function card(partial: Partial<HomeCard> & { id: string; name: string; category: string }): HomeCard {
  return {
    lat: 37.1498,
    lng: 127.0772,
    address: "경기도 오산시 테스트",
    mood: ["분위기", "데이트"],
    tags: ["분위기", "데이트"],
    description: "데이트하기 좋은 곳",
    ...partial,
  };
}

function parsedPath(q: string) {
  const parsed = parseScenarioIntent(q);
  const disc = classifyDiscoveryQuery(q, parsed);
  return {
    parsed,
    disc,
    detectStrict: detectStrictCategory(q),
    classifyIntent: classifyIntent(q),
    homeRepeat: shouldApplyHomeSituationRepeatAvoidance(q, parsed, disc),
    dateRepeat: shouldApplyDateRepeatAvoidance(q, parsed, disc),
  };
}

describe("DATE meal-time precedence V1", () => {
  it("DATE + meal-time-only queries become DATE discovery, not FOOD-strict", () => {
    for (const q of ["데이트할 곳", "오늘 데이트할 곳", "저녁 데이트", "저녁에 데이트할 곳"]) {
      const { parsed, disc, detectStrict, classifyIntent: intent } = parsedPath(q);
      expect(detectStrict, q).toBeNull();
      expect(intent, q).toBe("scenario_recommendation");
      expect(parsed.intentType, q).toBe("scenario_recommendation");
      expect(parsed.intentCategory, q).not.toBe("FOOD");
      expect(parsed.scenario, q).toBe("date");
      expect(disc.role, q).toBe("DATE");
      expect(disc.isDiscovery, q).toBe(true);
    }
  });

  it("genuine meal queries stay FOOD-strict", () => {
    for (const q of [
      "저녁 먹을 곳",
      "저녁 식사할 곳",
      "저녁에 둘이 밥 먹을 곳",
      "데이트하면서 저녁 먹을 곳",
      "데이트 맛집",
      "데이트 식당",
    ]) {
      const { parsed, disc, detectStrict, classifyIntent: intent } = parsedPath(q);
      expect(isExplicitDateMealTimeOnlyFoodLeak(q), q).toBe(false);
      expect(detectStrict, q).toBe("FOOD");
      expect(intent, q).toBe("search_strict");
      expect(parsed.intentType, q).toBe("search_strict");
      expect(parsed.intentCategory, q).toBe("FOOD");
      expect(disc.role, q).toBeNull();
      expect(disc.isDiscovery, q).toBe(false);
    }
  });

  it("커플끼리 외식할 곳 is genuine meal, not meal-time leak; Dining-Out V1 DATE override stays", () => {
    const q = "커플끼리 외식할 곳";
    expect(isExplicitDateMealTimeOnlyFoodLeak(q)).toBe(false);
    expect(isNeutralGenericDiningOutQuery(q)).toBe(false);
    const { parsed } = parsedPath(q);
    expect(parsed.scenario).toBe("date");
    expect(parsed.intentType === "search_strict" && parsed.intentCategory === "FOOD").toBe(false);
  });

  it("existing intent classification scenarios still pass", () => {
    expect(runIntentClassificationChecks()).toEqual([]);
  });

  it("DATE-07 Home Repeat is active across R1/R2/R3", () => {
    const q = "저녁에 데이트할 곳";
    const { parsed, disc, homeRepeat, dateRepeat } = parsedPath(q);
    expect(disc.role).toBe("DATE");
    expect(homeRepeat).toBe(true);
    expect(dateRepeat).toBe(true);

    const pool = [
      { id: "d1" },
      { id: "d2" },
      { id: "d3" },
      { id: "d4" },
      { id: "d5" },
      { id: "d6" },
      { id: "d7" },
      { id: "d8" },
      { id: "d9" },
    ];
    const r1 = applyRepeatAvoidanceToOrderedDeck(pool, [], 3);
    const r2 = applyRepeatAvoidanceToOrderedDeck(pool, r1.map((x) => x.id), 3);
    const r3 = applyRepeatAvoidanceToOrderedDeck(pool, [...r1, ...r2].map((x) => x.id), 3);
    expect(r1.map((x) => x.id)).toEqual(["d1", "d2", "d3"]);
    expect(r2.map((x) => x.id)).toEqual(["d4", "d5", "d6"]);
    expect(r3.map((x) => x.id)).toEqual(["d7", "d8", "d9"]);
    expect(r1.some((x) => r2.some((y) => y.id === x.id))).toBe(false);
    expect(parsed.scenario).toBe("date");
  });

  it("DATE-07 TOP3 is not restaurant-only FOOD lock", () => {
    const q = "저녁에 데이트할 곳";
    const parsed = parseScenarioIntent(q);
    const deck = buildTopRecommendations(
      [
        card({ id: "r1", name: "분위기파스타", category: "restaurant", distanceKm: 0.4 }),
        card({ id: "a1", name: "느루정원", category: "activity", distanceKm: 0.17 }),
        card({ id: "c1", name: "감성카페", category: "cafe", distanceKm: 0.3 }),
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
    expect(deck.every((x) => String(x.card.category).toLowerCase() === "restaurant")).toBe(false);
    expect(deck.some((x) => x.card.category === "cafe" || x.card.category === "activity")).toBe(true);
  });

  it("DATE-09 recommendation stays DATE and Home Repeat stays deferred", () => {
    const q = "오늘 둘이 뭐 하지?";
    const { parsed, disc, homeRepeat, dateRepeat } = parsedPath(q);
    expect(parsed.intentType).toBe("scenario_recommendation");
    expect(disc.role).toBe("DATE");
    expect(parsed.scenario).not.toBe("date");
    expect(dateRepeat).toBe(false);
    expect(homeRepeat).toBe(false);
  });
});
