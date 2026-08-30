import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it, vi } from "vitest";
import { buildRecommendationSessionSnapshot } from "@/lib/analytics/recommendationSessionSnapshot";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import {
  buildFrozenContextualRejectPayload,
  freezeContextualRejectContext,
} from "../contextualRejectLifecycle";

function card(partial: Partial<HomeCard> & { id: string; name: string }): HomeCard {
  return { category: "activity", ...partial };
}

const originalDeck: HomeCard[] = [
  card({
    id: "cbdfbc35-8452-4a19-915d-2d4ef939bb8e",
    name: "히어로보드게임카페 동탄호수공원점",
    distanceKm: 4.755,
  }),
  card({ id: "edda241a-eae3-4a40-b8ef-672989c6a084", name: "나만의 키즈카페", distanceKm: 7.323 }),
  card({
    id: "f06768d7-bb9d-408c-befb-628e2c098606",
    name: "트랩보드게임카페 동탄호수공원점",
    distanceKm: 4.933,
  }),
];

const replacementDeck: HomeCard[] = [
  card({ id: "replacement-top1", name: "교체된 TOP1", distanceKm: 1.1 }),
  card({ id: "replacement-2", name: "교체된 2", distanceKm: 2.2 }),
  card({ id: "replacement-3", name: "교체된 3", distanceKm: 3.3 }),
];

const scenario = { rawQuery: "오늘 뭐 하지?", scenario: "generic" } as ScenarioObject;

describe("contextual reject lifecycle", () => {
  it("keeps original reject context after deck refresh and TOO_FAR submits it", () => {
    const historyA = buildRecommendationSessionSnapshot({
      query: "오늘 뭐 하지?",
      scenario,
      cards: originalDeck,
    });
    const frozen = freezeContextualRejectContext({
      placeId: originalDeck[0].id,
      recommendationId: "d3e21166-b6df-46a3-9a50-cbb489c80e66",
      sessionHistory: {
        engine_version: historyA.engine_version,
        query: historyA.query,
        shown_places: historyA.shown_places,
      },
    });
    expect(frozen?.placeId).toBe(originalDeck[0].id);

    const historyB = buildRecommendationSessionSnapshot({
      query: "오늘 뭐 하지?",
      scenario,
      cards: replacementDeck,
    });
    const liveHistoryAfterShuffle = {
      engine_version: historyB.engine_version,
      query: historyB.query,
      shown_places: historyB.shown_places,
    };
    expect(liveHistoryAfterShuffle.shown_places[0]?.place_id).toBe("replacement-top1");

    const payload = buildFrozenContextualRejectPayload(frozen, "TOO_FAR");
    expect(payload).not.toBeNull();
    expect(payload?.place_id).toBe(originalDeck[0].id);
    expect(payload?.place_id).not.toBe("replacement-top1");
    expect(payload?.reject_reason).toBe("TOO_FAR");
    expect(payload?.shown_position).toBe(1);
    expect(payload?.distance_m_at_recommendation).toBe(4755);
    expect(payload?.recommendation_id).toBe("d3e21166-b6df-46a3-9a50-cbb489c80e66");
  });

  it("does not recompute distance from the replacement deck", () => {
    const historyA = buildRecommendationSessionSnapshot({
      query: "오늘 뭐 하지?",
      scenario,
      cards: originalDeck,
    });
    const frozen = freezeContextualRejectContext({
      placeId: originalDeck[0].id,
      recommendationId: "rec-1",
      sessionHistory: { shown_places: historyA.shown_places },
    });
    const mutatedLive = {
      shown_places: [
        { place_id: originalDeck[0].id, position: 1, name: originalDeck[0].name, distance_m: 99999 },
      ],
    };
    void mutatedLive;
    const payload = buildFrozenContextualRejectPayload(frozen, "TOO_FAR");
    expect(payload?.distance_m_at_recommendation).toBe(4755);
  });

  it("closes after submit by returning a one-shot payload (caller clears frozen)", () => {
    const frozen = freezeContextualRejectContext({
      placeId: originalDeck[0].id,
      recommendationId: "rec-1",
      sessionHistory: {
        shown_places: [{ place_id: originalDeck[0].id, position: 1, distance_m: 4755 }],
      },
    });
    const first = buildFrozenContextualRejectPayload(frozen, "TOO_FAR");
    const afterDismiss = buildFrozenContextualRejectPayload(null, "TOO_FAR");
    expect(first?.reject_reason).toBe("TOO_FAR");
    expect(afterDismiss).toBeNull();
  });
});

describe("Results ownership of contextual reject bar", () => {
  const resultsDir = resolve(__dirname, "..");
  const listSrc = readFileSync(resolve(resultsDir, "RecommendationList.tsx"), "utf8");
  const pageSrc = readFileSync(resolve(resultsDir, "../../results/page.tsx"), "utf8");

  it("lifts reason-bar state to Results so shuffle remount cannot destroy it", () => {
    expect(pageSrc).toContain("const [contextualReject, setContextualReject]");
    expect(pageSrc).toContain("freezeRejectForPlace");
    expect(pageSrc).toContain("<ContextualRejectReasonBar");
    expect(pageSrc).toMatch(/\{contextualReject \? \([\s\S]*ContextualRejectReasonBar/);
    expect(listSrc).not.toContain("showContextualReasons");
    expect(listSrc).not.toContain("ContextualRejectReasonBar");
  });

  it("keeps 다른 추천 보기 anonymous and does not login-gate TOO_FAR", () => {
    const refreshStart = listSrc.indexOf("onRejectRecommendation(id)");
    expect(refreshStart).toBeGreaterThan(0);
    const refreshWindow = listSrc.slice(Math.max(0, refreshStart - 400), refreshStart + 80);
    expect(refreshWindow).not.toMatch(/onRequireLogin/);
    expect(refreshWindow).not.toMatch(/isLoggedIn/);
    expect(pageSrc).toContain("freezeRejectForPlace(placeId)");
    const freezeHandler = pageSrc.slice(
      pageSrc.indexOf("const freezeRejectForPlace"),
      pageSrc.indexOf("const submitFrozenContextualReason")
    );
    const submitHandler = pageSrc.slice(
      pageSrc.indexOf("const submitFrozenContextualReason"),
      pageSrc.indexOf("const rejectMainAndRefresh")
    );
    expect(freezeHandler).not.toContain("requireKakaoLogin");
    expect(submitHandler).not.toContain("requireKakaoLogin");
    expect(submitHandler).not.toContain("isLoggedIn");
  });

  it("keeps 👎 별로 login-gated", () => {
    expect(listSrc).toMatch(/const submitFeedback[\s\S]*if \(!isLoggedIn\) \{\s*onRequireLogin/);
  });
});

describe("logger reachability from frozen submit", () => {
  it("TOO_FAR builds the contextual_reject payload the logger posts", async () => {
    vi.stubGlobal("window", globalThis);
    const { logContextualRejectFeedback } = await import(
      "@/lib/analytics/logContextualRejectFeedback"
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const historyA = buildRecommendationSessionSnapshot({
      query: "오늘 뭐 하지?",
      scenario,
      cards: originalDeck,
    });
    const frozen = freezeContextualRejectContext({
      placeId: originalDeck[0].id,
      recommendationId: "d3e21166-b6df-46a3-9a50-cbb489c80e66",
      sessionHistory: { shown_places: historyA.shown_places, query: historyA.query },
    });
    const payload = buildFrozenContextualRejectPayload(frozen, "TOO_FAR");
    expect(payload).not.toBeNull();
    logContextualRejectFeedback(payload!);
    expect(fetchSpy).toHaveBeenCalled();
    const call = fetchSpy.mock.calls.find((c) => String(c[0]).includes("/api/recommendation/log"));
    expect(call).toBeTruthy();
    const body = JSON.parse(String((call?.[1] as RequestInit | undefined)?.body ?? "{}"));
    expect(body.event_name).toBe("contextual_reject");
    expect(body.analytics_v2.reject_reason).toBe("TOO_FAR");
    expect(body.analytics_v2.selected_place_id).toBe(originalDeck[0].id);
    expect(body.metadata.distance_m_at_recommendation).toBe(4755);
    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
