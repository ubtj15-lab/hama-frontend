import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RECOMMENDATION_REJECT_REASONS,
  isRecommendationRejectReason,
} from "../recommendationRejectReasons";
import { buildRecommendationSessionSnapshot, mergeImpressionHistory } from "../recommendationSessionSnapshot";
import {
  buildContextualRejectPayload,
  buildContextualRejectResponseRow,
  resolveShownPlaceFromSessionHistory,
  shouldSkipRecommendationEventsTable,
} from "../contextualRejectFeedback";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";

function card(partial: Partial<HomeCard> & Pick<HomeCard, "id" | "name">): HomeCard {
  return { category: "restaurant", ...partial };
}

function scenario(): ScenarioObject {
  return {
    intentType: "scenario_recommendation",
    intentCategory: "CAFE",
    scenario: "generic",
    rawQuery: "카페 추천",
    queryUnderstanding: {
      rawQuery: "카페 추천",
      normalizedQuery: "카페 추천",
      route: "CAFE",
      primaryCategory: "cafe",
    },
  };
}

describe("Phase B contextual reject", () => {
  const first = buildRecommendationSessionSnapshot({
    query: "카페 추천",
    scenario: scenario(),
    cards: [
      card({ id: "place-x", name: "카페X", distanceKm: 18.4 }),
      card({ id: "place-y", name: "카페Y", distanceKm: 2.1 }),
      card({ id: "place-z", name: "카페Z" }),
    ],
  });
  const history = mergeImpressionHistory({}, first, "2026-08-29T00:00:00.000Z");

  it("TEST 1: TOO_FAR attaches to correct recommendation_id + place_id", () => {
    const payload = buildContextualRejectPayload({
      recommendationId: "rec-1",
      placeId: "place-x",
      reason: "TOO_FAR",
      sessionHistory: history,
    });
    expect(payload?.recommendation_id).toBe("rec-1");
    expect(payload?.place_id).toBe("place-x");
    expect(payload?.reject_reason).toBe("TOO_FAR");
  });

  it("TEST 2: TOO_FAR recovers Phase A distance, does not recompute", () => {
    const payload = buildContextualRejectPayload({
      recommendationId: "rec-1",
      placeId: "place-x",
      reason: "TOO_FAR",
      sessionHistory: history,
    });
    expect(payload?.distance_m_at_recommendation).toBe(18400);
    expect(payload?.shown_position).toBe(1);
  });

  it("TEST 3-6/8: payload is contextual only (no place penalty / catalog / suppression fields)", () => {
    for (const reason of ["TOO_FAR", "TOO_EXPENSIVE", "PARKING_DIFFICULT", "ALREADY_VISITED", "PLACE_INFO_WRONG"] as const) {
      const payload = buildContextualRejectPayload({
        recommendationId: "rec-1",
        placeId: "place-x",
        reason,
        sessionHistory: history,
      });
      const json = JSON.stringify(payload);
      expect(json).not.toMatch(/too_far\s*[:=]\s*true|global|penalty|suppress|hidden/i);
      expect(payload).not.toHaveProperty("place_score_delta");
      expect(payload).not.toHaveProperty("parking");
      expect(payload?.feedback_source).toBe("PRE_VISIT");
    }
  });

  it("TEST 7: NOT_WHAT_I_MEANT keeps query + qu_snapshot from Phase A history", () => {
    const payload = buildContextualRejectPayload({
      recommendationId: "rec-1",
      placeId: "place-y",
      reason: "NOT_WHAT_I_MEANT",
      sessionHistory: history,
    });
    expect(payload?.query).toBe("카페 추천");
    expect(payload?.qu_snapshot?.route).toBe("CAFE");
    expect(payload?.qu_snapshot?.intent_category).toBe("CAFE");
  });

  it("TEST 9: all eight canonical reasons serialize", () => {
    expect(RECOMMENDATION_REJECT_REASONS).toHaveLength(8);
    for (const reason of RECOMMENDATION_REJECT_REASONS) {
      const payload = buildContextualRejectPayload({
        recommendationId: "rec-1",
        placeId: "place-x",
        reason,
        sessionHistory: history,
      });
      expect(payload?.reject_reason).toBe(reason);
    }
  });

  it("TEST 10: invalid reason is ignored", () => {
    expect(isRecommendationRejectReason("FAR")).toBe(false);
    expect(
      buildContextualRejectPayload({
        recommendationId: "rec-1",
        placeId: "place-x",
        reason: "FAR",
        sessionHistory: history,
      })
    ).toBeNull();
  });

  it("TEST 11: missing shown place does not fabricate position/distance", () => {
    const payload = buildContextualRejectPayload({
      recommendationId: "rec-1",
      placeId: "never-shown",
      reason: "TOO_FAR",
      sessionHistory: history,
    });
    expect(payload?.shown_place_unverified).toBe(true);
    expect(payload?.shown_position).toBeNull();
    expect(payload?.distance_m_at_recommendation).toBeNull();
  });

  it("TEST 12: shuffle history resolves a previously shown place", () => {
    const shuffled = buildRecommendationSessionSnapshot({
      query: "카페 추천",
      scenario: scenario(),
      cards: [
        card({ id: "place-new", name: "새카페", distanceKm: 1 }),
        card({ id: "place-n2", name: "N2", distanceKm: 2 }),
        card({ id: "place-n3", name: "N3", distanceKm: 3 }),
      ],
    });
    const afterShuffle = mergeImpressionHistory(history, shuffled, "2026-08-29T00:01:00.000Z");
    expect(resolveShownPlaceFromSessionHistory(afterShuffle, "place-x")?.distance_m).toBe(18400);
    const payload = buildContextualRejectPayload({
      recommendationId: "rec-1",
      placeId: "place-x",
      reason: "TOO_FAR",
      sessionHistory: afterShuffle,
    });
    expect(payload?.distance_m_at_recommendation).toBe(18400);
    expect(payload?.shown_position).toBe(1);
  });

  it("TEST 13: missing ids are non-blocking (null payload)", () => {
    expect(
      buildContextualRejectPayload({
        recommendationId: "",
        placeId: "place-x",
        reason: "TOO_FAR",
        sessionHistory: history,
      })
    ).toBeNull();
  });

  it("TEST 14: anonymous payload does not require user_id", () => {
    const payload = buildContextualRejectPayload({
      recommendationId: "rec-1",
      placeId: "place-x",
      reason: "OTHER",
      sessionHistory: history,
    });
    expect(payload).not.toHaveProperty("user_id");
  });

  it("TEST 15: Phase B modules do not import behavior scoring", () => {
    const dir = path.join(__dirname, "..");
    for (const file of ["contextualRejectFeedback.ts", "logContextualRejectFeedback.ts", "recommendationRejectReasons.ts"]) {
      const src = readFileSync(path.join(dir, file), "utf8");
      expect(src).not.toMatch(/behaviorSignalStore|getPlaceBehaviorRaw|negative_feedback|place_feedback/);
    }
    const logger = readFileSync(path.join(dir, "logContextualRejectFeedback.ts"), "utf8");
    expect(logger).not.toMatch(/logRecommendationEvent|recordBehaviorFromRecommendationEvent/);
    const route = readFileSync(
      path.join(__dirname, "..", "..", "..", "api", "recommendation", "log", "route.ts"),
      "utf8"
    );
    expect(route).not.toMatch(/behaviorSignalStore|getPlaceBehaviorRaw/);
    expect(route).toMatch(/shouldSkipRecommendationEventsTable/);
    const bar = readFileSync(
      path.join(__dirname, "..", "..", "..", "_components", "results", "ContextualRejectReasonBar.tsx"),
      "utf8"
    );
    expect(bar).not.toMatch(/behaviorSignalStore|getPlaceBehaviorRaw|negative_feedback|place_feedback/);
  });

  it("TEST 16: Phase B does not import frozen ranking/QU modules", () => {
    const files = [
      path.join(__dirname, "..", "contextualRejectFeedback.ts"),
      path.join(__dirname, "..", "logContextualRejectFeedback.ts"),
      path.join(__dirname, "..", "recommendationRejectReasons.ts"),
      path.join(__dirname, "..", "..", "..", "_components", "results", "ContextualRejectReasonBar.tsx"),
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(
        /scoring\.ts|queryUnderstanding|negationUnderstanding|foodIntentRanking|exposureRerank|menuRelevance|conversationalDiscovery/
      );
    }
  });

  it("TEST 13b: persistence helpers stay non-blocking and skip events table", () => {
    expect(shouldSkipRecommendationEventsTable("contextual_reject")).toBe(true);
    expect(shouldSkipRecommendationEventsTable("recommendation_impression")).toBe(false);
    expect(
      buildContextualRejectPayload({
        recommendationId: "",
        placeId: "place-x",
        reason: "TOO_FAR",
        sessionHistory: history,
      })
    ).toBeNull();
  });

  it("anonymous response row keeps user_id null and stores PRE_VISIT", () => {
    const payload = buildContextualRejectPayload({
      recommendationId: "11111111-1111-4111-8111-111111111111",
      placeId: "place-x",
      reason: "TOO_FAR",
      sessionHistory: history,
    });
    expect(payload).not.toBeNull();
    const row = buildContextualRejectResponseRow({
      recommendationId: payload!.recommendation_id,
      userId: null,
      sessionId: "session_anon",
      payload: payload!,
    });
    expect(row.user_id).toBeNull();
    expect(row.session_id).toBe("session_anon");
    expect(row.reject_reason).toBe("TOO_FAR");
    expect(row.selected_place_id).toBe("place-x");
    expect(row.metadata.feedback_source).toBe("PRE_VISIT");
    expect(row.metadata.distance_m_at_recommendation).toBe(18400);
    expect(JSON.stringify(row.metadata)).not.toMatch(/"lat"|"lng"|"latitude"|"longitude"/);
  });

  it("TEST 16: building reject payload does not mutate session history", () => {
    const before = JSON.stringify(history);
    buildContextualRejectPayload({
      recommendationId: "rec-1",
      placeId: "place-x",
      reason: "TOO_FAR",
      sessionHistory: history,
    });
    expect(JSON.stringify(history)).toBe(before);
  });
});
