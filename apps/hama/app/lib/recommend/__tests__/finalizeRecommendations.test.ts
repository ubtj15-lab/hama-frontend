import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { finalizeRecommendations } from "../finalizeRecommendations";
import type { ScoredRecommendItem } from "../scoring";
import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendScoreBreakdown } from "../scoring";

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

describe("finalizeRecommendations", () => {
  it("promotes kid-play from a mixed pool on the indoor-play query", () => {
    const q = "아이들이랑 실내에서 놀 만한 데 없어?";
    const parsed = parseScenarioIntent(q);
    const steak = scored(card({ id: "r1", name: "더브라질 스테이크", category: "restaurant" }), 88);
    const cafe = scored(card({ id: "c1", name: "카페위안", category: "cafe" }), 80);
    const soup = scored(card({ id: "r2", name: "능이밥상", category: "restaurant" }), 76);
    const kids = scored(
      card({
        id: "a1",
        name: "키즈아트 체험카페",
        category: "activity",
        tags: ["키즈카페", "실내", "놀이"],
        with_kids: true,
      }),
      62
    );
    const board = scored(
      card({
        id: "a2",
        name: "보드게임 키즈존",
        category: "activity",
        tags: ["보드게임", "키즈"],
        with_kids: true,
      }),
      58
    );
    const out = finalizeRecommendations({
      query: q,
      parsed,
      ranked: [steak, cafe, soup],
      scoredPool: [steak, cafe, soup, kids, board],
      deckSize: 3,
    });
    expect(parsed.withKids).toBe(true);
    expect(out.classification.role).toBe("PLAY");
    expect(out.applied).toBe(true);
    const cats = out.deck.map((d) => d.card.category);
    expect(cats.some((c) => c === "activity")).toBe(true);
    expect(out.deck.some((d) => /키즈|보드게임/.test(`${d.card.name} ${(d.card.tags ?? []).join(" ")}`))).toBe(
      true
    );
  });

  it("keeps family/activity direction on 애들 general outing", () => {
    const q = "오늘 애들이랑 어디 가지?";
    const parsed = parseScenarioIntent(q);
    const cafe = scored(card({ id: "c1", name: "카페밀", category: "cafe" }), 84);
    const soup = scored(card({ id: "r1", name: "순대국집", category: "restaurant" }), 80);
    const chinese = scored(card({ id: "r2", name: "한성각", category: "restaurant" }), 78);
    const play = scored(
      card({
        id: "a1",
        name: "가족 체험관",
        category: "activity",
        tags: ["키즈", "체험", "가족"],
        with_kids: true,
      }),
      60
    );
    const out = finalizeRecommendations({
      query: q,
      parsed,
      ranked: [cafe, soup, chinese],
      scoredPool: [cafe, soup, chinese, play],
      deckSize: 3,
    });
    expect(parsed.withKids).toBe(true);
    expect(out.classification.role).toBe("FAMILY_OUTING");
    expect(out.applied).toBe(true);
    expect(out.deck.some((d) => d.card.category === "activity")).toBe(true);
  });

  it("does not turn kids food into play", () => {
    const q = "아이들이랑 맛있는 거 먹으러 가고 싶어";
    const parsed = parseScenarioIntent(q);
    const r1 = scored(card({ id: "r1", name: "갑짬뽕", category: "restaurant", tags: ["짬뽕"] }), 90);
    const r2 = scored(card({ id: "r2", name: "한식당", category: "restaurant" }), 84);
    const play = scored(
      card({ id: "a1", name: "키즈카페", category: "activity", tags: ["키즈카페"], with_kids: true }),
      70
    );
    const out = finalizeRecommendations({
      query: q,
      parsed,
      ranked: [r1, r2, play],
      scoredPool: [r1, r2, play],
      deckSize: 3,
    });
    expect(parsed.intentCategory).toBe("FOOD");
    expect(out.applied).toBe(false);
    expect(out.deck[0]?.card.category).toBe("restaurant");
    expect(out.deck.filter((d) => d.card.category === "restaurant").length).toBeGreaterThanOrEqual(2);
  });

  it("excludes nightlife from a kids pool before discovery", () => {
    const q = "아이들이랑 실내에서 놀 만한 데 없어?";
    const parsed = parseScenarioIntent(q);
    const pub = scored(card({ id: "n1", name: "감성주점 포차", category: "restaurant", tags: ["포차"] }), 95);
    const kids = scored(
      card({
        id: "a1",
        name: "실내 키즈존",
        category: "activity",
        tags: ["키즈", "놀이"],
        with_kids: true,
      }),
      55
    );
    const out = finalizeRecommendations({
      query: q,
      parsed,
      ranked: [pub],
      scoredPool: [pub, kids],
      deckSize: 3,
    });
    expect(out.eligiblePool.some((d) => d.card.id === "n1")).toBe(false);
    expect(out.deck.some((d) => d.card.id === "a1")).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const q = "아 뭐 하지? 아무거나 괜찮은 데 골라줘";
    const parsed = parseScenarioIntent(q);
    const pool = [
      scored(card({ id: "c1", name: "조용한 카페", category: "cafe" }), 70),
      scored(card({ id: "a1", name: "산책공원", category: "activity", tags: ["공원"] }), 68),
      scored(card({ id: "r1", name: "백반집", category: "restaurant" }), 66),
    ];
    const a = finalizeRecommendations({ query: q, parsed, ranked: pool, scoredPool: pool, deckSize: 3 });
    const b = finalizeRecommendations({ query: q, parsed, ranked: pool, scoredPool: pool, deckSize: 3 });
    expect(a.deck.map((d) => d.card.id)).toEqual(b.deck.map((d) => d.card.id));
  });
});

describe("shared finalizer wiring", () => {
  it("Results orchestration imports finalizeRecommendations", () => {
    const src = readFileSync(resolve(__dirname, "../../../_hooks/useHomeCards.ts"), "utf8");
    expect(src).toContain('from "@/lib/recommend/finalizeRecommendations"');
    expect(src).toContain("finalizeRecommendations(");
    expect(src).toContain("resolveFinalRecommendationDeck(");
  });

  it("simulator discovery adapter delegates to finalizeDiscoveryPool", () => {
    const src = readFileSync(
      resolve(__dirname, "../../../../scripts/recommendation-simulator/engineAdapter.ts"),
      "utf8"
    );
    expect(src).toContain("finalizeDiscoveryPool");
    expect(src).not.toMatch(/applyDiscoveryRerank\s*\(/);
  });
});
