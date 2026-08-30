import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RECOMMENDATION_ENGINE_VERSION } from "../recommendationEngineVersion";
import {
  createRecommendationSessionId,
  shouldResetRecommendationSession,
} from "../recommendationSessionIdentity";
import {
  buildRecommendationSessionSnapshot,
  distanceKmToMetersForSnapshot,
  mergeImpressionHistory,
  snapshotContainsOriginCoordinates,
} from "../recommendationSessionSnapshot";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";

function card(partial: Partial<HomeCard> & Pick<HomeCard, "id" | "name">): HomeCard {
  return {
    category: "restaurant",
    ...partial,
  };
}

function scenario(partial: Partial<ScenarioObject> = {}): ScenarioObject {
  return {
    intentType: "scenario_recommendation",
    scenario: "generic",
    rawQuery: "칼국수 먹고 싶어",
    ...partial,
  };
}

describe("recommendation session identity", () => {
  it("TEST 1: initial recommendation is a new decision session", () => {
    expect(shouldResetRecommendationSession(null, "칼국수 먹고 싶어")).toBe(true);
    expect(createRecommendationSessionId().length).toBeGreaterThan(8);
  });

  it("TEST 2: shuffle/reject refresh with the same query does not reset the session", () => {
    expect(shouldResetRecommendationSession("칼국수 먹고 싶어", "칼국수 먹고 싶어")).toBe(false);
  });

  it("TEST 3: a genuinely new query creates a new session", () => {
    expect(shouldResetRecommendationSession("칼국수 먹고 싶어", "카페 추천")).toBe(true);
  });
});

describe("recommendation session snapshot", () => {
  const cards = [
    card({ id: "a", name: "가게A", distanceKm: 3.2, reasonText: "가까워요" }),
    card({ id: "b", name: "가게B", distanceKm: 5.8 }),
    card({ id: "c", name: "가게C" }),
  ];

  it("TEST 4: TOP3 snapshot preserves positions 1/2/3", () => {
    const snap = buildRecommendationSessionSnapshot({
      query: "칼국수 먹고 싶어",
      scenario: scenario(),
      cards,
    });
    expect(snap.shown_places.map((p) => p.position)).toEqual([1, 2, 3]);
    expect(snap.shown_places.map((p) => p.place_id)).toEqual(["a", "b", "c"]);
  });

  it("TEST 5: each shown item stores distance_m when available", () => {
    expect(distanceKmToMetersForSnapshot(3.2)).toBe(3200);
    const snap = buildRecommendationSessionSnapshot({
      query: "칼국수 먹고 싶어",
      scenario: scenario(),
      cards,
    });
    expect(snap.shown_places[0].distance_m).toBe(3200);
    expect(snap.shown_places[1].distance_m).toBe(5800);
  });

  it("TEST 6: missing distance stores null, not a fabricated value", () => {
    expect(distanceKmToMetersForSnapshot(undefined)).toBeNull();
    expect(distanceKmToMetersForSnapshot(null)).toBeNull();
    expect(distanceKmToMetersForSnapshot(Number.NaN)).toBeNull();
    const snap = buildRecommendationSessionSnapshot({
      query: "칼국수 먹고 싶어",
      scenario: scenario(),
      cards,
    });
    expect(snap.shown_places[2].distance_m).toBeNull();
    expect(snap.shown_places[2].travel_time_min).toBeNull();
  });

  it("TEST 7: qu_snapshot contains passive existing interpretation fields", () => {
    const snap = buildRecommendationSessionSnapshot({
      query: "칼국수 빼고",
      scenario: scenario({
        intentType: "search_strict",
        intentCategory: "FOOD",
        menuIntent: ["칼국수"],
        conversationalDiscovery: {
          isRecommendationSeeking: false,
          decisionOpenness: false,
          activitySeeking: false,
          outingSeeking: false,
          spareTimeSignal: false,
          boredomSignal: false,
          changeOfSceneSignal: false,
          confidence: 0,
          evidence: [],
          semanticClass: null,
          detected: false,
          blockedBySpecificIntent: true,
          blockReason: "menu",
        },
        queryUnderstanding: {
          rawQuery: "칼국수 빼고",
          normalizedQuery: "칼국수 빼고",
          route: "FOOD",
          primaryCategory: "restaurant",
          menuIntents: ["칼국수"],
          companionIntents: ["friend"],
          purposeIntents: ["meal"],
          negation: {
            isNegationQuery: true,
            patterns: ["빼고"],
            types: ["exclusion"],
            excludedCategories: [],
            excludedMenus: ["칼국수"],
            excludedContexts: [],
            excludedAttributes: [],
            suppressedIntents: [],
            excludedVenues: [],
            positiveRemainder: "",
            positivePurpose: [],
            hardExclusions: ["칼국수"],
            softSuppressions: [],
            fallbackReason: null,
          },
        },
      }),
      cards,
    });
    expect(snap.qu_snapshot.route).toBe("FOOD");
    expect(snap.qu_snapshot.primary_category).toBe("restaurant");
    expect(snap.qu_snapshot.intent_type).toBe("search_strict");
    expect(snap.qu_snapshot.intent_category).toBe("FOOD");
    expect(snap.qu_snapshot.menu_intent).toEqual(["칼국수"]);
    expect(snap.qu_snapshot.companion).toEqual(["friend"]);
    expect(snap.qu_snapshot.purpose).toEqual(["meal"]);
    expect(snap.qu_snapshot.negation_detected).toBe(true);
    expect(snap.qu_snapshot.excluded_menus).toEqual(["칼국수"]);
  });

  it("TEST 8: engine_version is recommendation-v1", () => {
    const snap = buildRecommendationSessionSnapshot({
      query: "칼국수",
      scenario: scenario(),
      cards,
    });
    expect(snap.engine_version).toBe("recommendation-v1");
    expect(RECOMMENDATION_ENGINE_VERSION).toBe("recommendation-v1");
  });

  it("TEST 9: persistence/merge failure must not throw into recommendation output", () => {
    const snap = buildRecommendationSessionSnapshot({
      query: "칼국수",
      scenario: scenario(),
      cards,
    });
    expect(() => mergeImpressionHistory(undefined, snap, "2026-08-29T00:00:00.000Z")).not.toThrow();
    expect(() => mergeImpressionHistory({ impressions: "bad" as unknown as never }, snap, "2026-08-29T00:00:00.000Z")).not.toThrow();
  });

  it("TEST 10: no exact lat/lng added to the snapshot", () => {
    const withGps = card({
      id: "g",
      name: "gps",
      lat: 37.15,
      lng: 127.07,
      distanceKm: 1,
    });
    const snap = buildRecommendationSessionSnapshot({
      query: "칼국수",
      scenario: scenario(),
      cards: [withGps],
    });
    expect(snapshotContainsOriginCoordinates(snap)).toBe(false);
    expect("lat" in snap.shown_places[0]).toBe(false);
    expect("lng" in snap.shown_places[0]).toBe(false);
  });

  it("TEST 11: Phase A snapshot module does not write to behavior scoring", () => {
    const src = readFileSync(
      path.join(__dirname, "..", "recommendationSessionSnapshot.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/negative_feedback|place_feedback|getPlaceBehaviorRaw|behaviorSignalStore/);
  });

  it("TEST 12: snapshot build does not mutate recommendation cards", () => {
    const original = [
      card({ id: "a", name: "가게A", distanceKm: 1.5, category: "restaurant" }),
      card({ id: "b", name: "가게B", distanceKm: 2.5, category: "cafe" }),
    ];
    const before = JSON.stringify(original);
    const snap = buildRecommendationSessionSnapshot({
      query: "칼국수",
      scenario: scenario(),
      cards: original,
    });
    expect(JSON.stringify(original)).toBe(before);
    expect(snap.shown_places).toHaveLength(2);
    original[0].distanceKm = 99;
    expect(snap.shown_places[0].distance_m).toBe(1500);
  });

  it("same-session shuffle history keeps engine_version and overwrites current TOP3", () => {
    const first = buildRecommendationSessionSnapshot({
      query: "칼국수",
      scenario: scenario(),
      cards: [card({ id: "a", name: "A", distanceKm: 1 })],
    });
    const meta1 = mergeImpressionHistory({}, first, "2026-08-29T00:00:00.000Z");
    const second = buildRecommendationSessionSnapshot({
      query: "칼국수",
      scenario: scenario(),
      cards: [card({ id: "z", name: "Z", distanceKm: 4 })],
    });
    const meta2 = mergeImpressionHistory(meta1, second, "2026-08-29T00:01:00.000Z");
    expect(meta2.engine_version).toBe("recommendation-v1");
    expect((meta2.shown_places as { place_id: string }[])[0].place_id).toBe("z");
    expect((meta2.impressions as unknown[]).length).toBe(2);
  });
});
