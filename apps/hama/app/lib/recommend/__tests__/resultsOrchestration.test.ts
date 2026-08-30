import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { classifyDiscoveryQuery } from "../discoveryRole";
import { finalizeRecommendations } from "../finalizeRecommendations";
import { processConversationTurn } from "@/lib/conversation/processTurn";
import { mergeResultsScenario } from "@/lib/conversation/mergeResultsScenario";
import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendScoreBreakdown, ScoredRecommendItem } from "../scoring";

function card(partial: Partial<HomeCard> & Pick<HomeCard, "id" | "name" | "category">): HomeCard {
  return {
    lat: 37.1498,
    lng: 127.0772,
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

function scored(c: HomeCard, finalScore: number): ScoredRecommendItem {
  return {
    card: c,
    reasonText: "",
    reasonVoice: "solo",
    breakdown: { finalScore } as RecommendScoreBreakdown,
  };
}

function runFinalizer(query: string, ranked: ScoredRecommendItem[], pool: ScoredRecommendItem[]) {
  const parsed = parseScenarioIntent(query);
  const finalized = finalizeRecommendations({
    query,
    parsed,
    ranked,
    scoredPool: pool,
    deckSize: 3,
  });
  return { parsed, finalized, classification: classifyDiscoveryQuery(query, parsed) };
}

describe("Results recommendation orchestration (shared finalizer)", () => {
  const steak = scored(card({ id: "food-1", name: "스테이크집", category: "restaurant" }), 86);
  const cafe = scored(card({ id: "cafe-1", name: "일반카페", category: "cafe" }), 82);
  const soup = scored(card({ id: "food-2", name: "한식당", category: "restaurant" }), 78);
  const kidsPlay = scored(
    card({
      id: "play-1",
      name: "실내 키즈아트",
      category: "activity",
      tags: ["키즈카페", "실내", "놀이"],
      with_kids: true,
    }),
    61
  );
  const kidsPlay2 = scored(
    card({
      id: "play-2",
      name: "키즈 보드카페",
      category: "activity",
      tags: ["키즈", "보드게임"],
      with_kids: true,
    }),
    57
  );

  it("indoor-play: eligible kid-play appears in TOP3", () => {
    const q = "아이들이랑 실내에서 놀 만한 데 없어?";
    const { parsed, finalized, classification } = runFinalizer(
      q,
      [steak, cafe, soup],
      [steak, cafe, soup, kidsPlay, kidsPlay2]
    );
    expect(parsed.withKids).toBe(true);
    expect(parsed.indoorPreferred).toBe(true);
    expect(parsed.queryUnderstanding?.purposeIntents ?? []).toContain("indoor_play");
    expect(classification.role).toBe("PLAY");
    expect(finalized.applied).toBe(true);
    expect(finalized.deck.some((d) => d.card.category === "activity")).toBe(true);
    const names = finalized.deck.map((d) => d.card.name).join(" ");
    expect(/스테이크|일반카페|한식당/.test(names) && finalized.deck.every((d) => d.card.category !== "activity")).toBe(
      false
    );
  });

  it("family-general: preserves family/activity direction", () => {
    const q = "오늘 애들이랑 어디 가지?";
    const { parsed, finalized, classification } = runFinalizer(
      q,
      [cafe, soup, steak],
      [cafe, soup, steak, kidsPlay]
    );
    expect(parsed.withKids).toBe(true);
    expect(classification.role).toBe("FAMILY_OUTING");
    expect(finalized.applied).toBe(true);
    expect(finalized.deck.some((d) => d.card.category === "activity" || /키즈|체험/.test(d.card.name))).toBe(true);
  });

  it("kids food stays FOOD-oriented", () => {
    const q = "아이들이랑 맛있는 거 먹으러 가고 싶어";
    const { parsed, finalized, classification } = runFinalizer(q, [steak, soup, kidsPlay], [steak, soup, kidsPlay]);
    expect(parsed.intentCategory).toBe("FOOD");
    expect(classification.isDiscovery).toBe(false);
    expect(finalized.applied).toBe(false);
    expect(finalized.deck.slice(0, 2).every((d) => d.card.category === "restaurant")).toBe(true);
  });

  it("solo cafe is not forced to kids-play", () => {
    const q = "혼자 조용히 카페 가고 싶어";
    const { parsed, finalized } = runFinalizer(q, [cafe, steak, kidsPlay], [cafe, steak, kidsPlay]);
    expect(parsed.withKids).not.toBe(true);
    expect(finalized.deck[0]?.card.category).not.toBe("activity");
  });

  it("indoor relax is not kids-play", () => {
    const q = "실내에서 조용히 쉬고 싶어";
    const { parsed, classification } = runFinalizer(q, [cafe, steak, kidsPlay], [cafe, steak, kidsPlay]);
    expect(parsed.withKids).not.toBe(true);
    expect(classification.role).toBe("RELAX");
    expect(classification.role).not.toBe("PLAY");
  });

  it("kids cafe request is not forced PLAY", () => {
    const q = "아이랑 카페 가고 싶어";
    const { parsed, classification } = runFinalizer(q, [cafe, kidsPlay, steak], [cafe, kidsPlay, steak]);
    expect(parsed.intentCategory).toBe("CAFE");
    expect(classification.role).not.toBe("PLAY");
  });

  it("kids park stays outdoor, not generic food-only", () => {
    const q = "아이들이랑 공원 가고 싶어";
    const park = scored(
      card({ id: "park-1", name: "느티근린공원", category: "activity", tags: ["공원", "산책"] }),
      59
    );
    const { parsed, finalized, classification } = runFinalizer(
      q,
      [steak, cafe, soup],
      [steak, cafe, soup, park]
    );
    expect(parsed.withKids).toBe(true);
    expect(classification.role).toBe("OUTDOOR");
    expect(finalized.applied).toBe(true);
    expect(finalized.deck.some((d) => d.card.id === "park-1" || d.card.category === "activity")).toBe(true);
  });

  it("uses current q + PLAY scenario, not cumulative 데이트 text", () => {
    const current = "아이들이랑 실내에서 놀 만한 데 없어?";
    const prev = processConversationTurn("데이트", null, { persist: false });
    const ctx = processConversationTurn(current, prev, { persist: false });
    expect(ctx.cumulativeText).toContain("데이트");
    const semanticQuery = current;
    expect(semanticQuery).not.toContain("데이트 ·");
    const merged = mergeResultsScenario(current, ctx)!;
    expect(classifyDiscoveryQuery(semanticQuery, merged).role).toBe("PLAY");
    const { finalized } = runFinalizer(semanticQuery, [steak, cafe, soup], [steak, cafe, soup, kidsPlay, kidsPlay2]);
    expect(finalized.applied).toBe(true);
    expect(finalized.classification.role).toBe("PLAY");
    expect(finalized.deck.some((d) => d.card.category === "activity")).toBe(true);
  });
});
