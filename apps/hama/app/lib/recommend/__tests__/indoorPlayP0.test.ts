import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import {
  classifyDiscoveryQuery,
  hasCredibleIndoorPlayEvidence,
  isExplicitHoldemPokerQuery,
  isHoldemPokerCodedVenue,
  isIndoorPlaySeekingQuery,
  shouldHideHoldemPokerForGenericIndoorPlay,
  toDiscoveryItem,
} from "../discoveryRole";
import { getHomeSituationCandidate } from "@/_components/home/homeSituationCandidates";
import { resolveHomeResultsUrl } from "@/lib/hamaTabClickTrace";
import { finalizeRecommendations, isExplicitKidsRecommendationContext } from "../finalizeRecommendations";
import { DEFAULT_LOCAL_MAX_KM, resolveLocalDistanceCapKm } from "../localDistanceSafety";
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

const CAFE = card({ id: "cafe-1", name: "데일리 오아시", category: "cafe", tags: ["카페"] });
const JJAMPONG = card({ id: "food-1", name: "역대짬뽕", category: "restaurant", tags: ["짬뽕"] });
const MANDU = card({ id: "food-2", name: "초언니만두점", category: "restaurant", tags: ["만두"] });
const BOARD = card({
  id: "act-1",
  name: "보드게임카페 레드버튼",
  category: "activity",
  tags: ["보드게임", "실내"],
});
const BOWLING = card({
  id: "act-2",
  name: "볼링장",
  category: "activity",
  tags: ["볼링", "실내"],
});
const ESCAPE = card({
  id: "act-3",
  name: "방탈출카페",
  category: "activity",
  tags: ["방탈출", "실내"],
});
const PARK = card({
  id: "park-dowon",
  name: "도원공원",
  category: "activity",
  tags: ["아이동반", "액티비티"],
  with_kids: true,
});
const NAMDO = card({
  id: "food-namdo",
  name: "남도연프리미엄",
  category: "restaurant",
  tags: ["한식", "아이동반"],
  with_kids: true,
});
const NEUNGI = card({
  id: "food-neungi",
  name: "능이밥상 오산직영점",
  category: "restaurant",
  tags: ["보양식", "아이동반"],
  with_kids: true,
});
const HOLDEM = card({
  id: "act-holdem",
  name: "홀덤펍보드카페",
  category: "activity",
  tags: ["홀덤", "보드게임", "실내"],
});

function classify(q: string) {
  const parsed = parseScenarioIntent(q);
  return { parsed, classification: classifyDiscoveryQuery(q, parsed) };
}

function deck(q: string) {
  const parsed = parseScenarioIntent(q);
  const pool = [
    scored(CAFE, 90),
    scored(JJAMPONG, 88),
    scored(MANDU, 86),
    scored(NAMDO, 85),
    scored(NEUNGI, 84),
    scored(PARK, 82),
    scored(BOARD, 70),
    scored(BOWLING, 68),
    scored(ESCAPE, 66),
  ];
  return finalizeRecommendations({
    query: q,
    parsed,
    ranked: [scored(CAFE, 90), scored(JJAMPONG, 88), scored(MANDU, 86)],
    scoredPool: pool,
    deckSize: 3,
  });
}

describe("P0 generic indoor PLAY bridge", () => {
  it("A 오늘은 실내에서 놀까? → PLAY, not kids", () => {
    const q = "오늘은 실내에서 놀까?";
    const { parsed, classification } = classify(q);
    expect(isIndoorPlaySeekingQuery(q, parsed)).toBe(true);
    expect(classification.role).toBe("PLAY");
    expect(parsed.withKids).not.toBe(true);
    expect(isExplicitKidsRecommendationContext(parsed)).toBe(false);
    const out = deck(q);
    expect(out.classification.role).toBe("PLAY");
    expect(out.deck.every((d) => d.card.category === "activity")).toBe(true);
    expect(out.deck.some((d) => d.card.category === "cafe" || d.card.category === "restaurant")).toBe(false);
  });

  it("B 실내에서 놀 만한 곳 → PLAY", () => {
    const q = "실내에서 놀 만한 곳";
    const { parsed, classification } = classify(q);
    expect(classification.role).toBe("PLAY");
    expect(parsed.withKids).not.toBe(true);
    expect(deck(q).deck.every((d) => d.card.category === "activity")).toBe(true);
  });

  it("C 오늘 실내에서 뭐 하지? → PLAY", () => {
    const q = "오늘 실내에서 뭐 하지?";
    const { classification } = classify(q);
    expect(classification.role).toBe("PLAY");
    expect(deck(q).deck.every((d) => d.card.category === "activity")).toBe(true);
  });

  it("D 비 오면 실내에서 어디 가지? → PLAY not restaurant default", () => {
    const q = "비 오면 실내에서 어디 가지?";
    const { classification } = classify(q);
    expect(classification.role).toBe("PLAY");
    const cats = deck(q).deck.map((d) => d.card.category);
    expect(cats.every((c) => c === "activity")).toBe(true);
    expect(cats.includes("restaurant")).toBe(false);
  });

  it("E 실내 놀거리 추천해줘 → PLAY", () => {
    const q = "실내 놀거리 추천해줘";
    expect(classify(q).classification.role).toBe("PLAY");
    expect(deck(q).deck.every((d) => d.card.category === "activity")).toBe(true);
  });

  it("F 실내에서 쉬고 싶어 → NOT forced PLAY", () => {
    const q = "실내에서 쉬고 싶어";
    const { parsed, classification } = classify(q);
    expect(isIndoorPlaySeekingQuery(q, parsed)).toBe(false);
    expect(classification.role).not.toBe("PLAY");
    expect(classification.role).toBe("RELAX");
  });

  it("G 조용한 실내 카페 → cafe semantics preserved", () => {
    const q = "조용한 실내 카페";
    const { parsed, classification } = classify(q);
    expect(isIndoorPlaySeekingQuery(q, parsed)).toBe(false);
    expect(classification.role).not.toBe("PLAY");
  });

  it("H 실내 식당 → restaurant semantics preserved", () => {
    const q = "실내 식당";
    const { parsed, classification } = classify(q);
    expect(isIndoorPlaySeekingQuery(q, parsed)).toBe(false);
    expect(classification.role).not.toBe("PLAY");
  });

  it("rain-only 뭐하지 stays INDOOR, not generic PLAY", () => {
    expect(classify("비 오는데 뭐하지").classification.role).toBe("INDOOR");
  });

  it("I kids + indoor play protected behavior remains", () => {
    const q = "아이들이랑 실내에서 놀 만한 데 없어?";
    const { parsed, classification } = classify(q);
    expect(parsed.withKids).toBe(true);
    expect(classification.role).toBe("PLAY");
    expect(isExplicitKidsRecommendationContext(parsed)).toBe(true);
  });

  it("J generic indoor play does not activate Kids/Adult Safety", () => {
    const q = "오늘은 실내에서 놀까?";
    const { parsed } = classify(q);
    expect(parsed.withKids).not.toBe(true);
    expect(isExplicitKidsRecommendationContext(parsed)).toBe(false);
  });

  it("K 15km Distance Safety remains unchanged", () => {
    const parsed = parseScenarioIntent("오늘은 실내에서 놀까?");
    expect(resolveLocalDistanceCapKm("오늘은 실내에서 놀까?", parsed)).toBe(DEFAULT_LOCAL_MAX_KM);
    expect(resolveLocalDistanceCapKm("가까운 실내 놀거리", parseScenarioIntent("가까운 실내 놀거리"))).toBe(5);
  });

  it("does not force PLAY on indoor coffee or rain cafe", () => {
    expect(isIndoorPlaySeekingQuery("실내에서 커피 마시고 싶어", parseScenarioIntent("실내에서 커피 마시고 싶어"))).toBe(
      false
    );
    expect(classify("비 오는 날 카페").classification.role).not.toBe("PLAY");
    expect(classify("오늘 밥 먹으러 갈까").classification.isDiscovery).toBe(false);
  });

  it("E2 도원공원 is not indoor-play eligible", () => {
    expect(hasCredibleIndoorPlayEvidence(toDiscoveryItem(PARK, 82))).toBe(false);
    const names = deck("오늘 실내에서 놀까?").deck.map((d) => d.card.name);
    expect(names).not.toContain("도원공원");
  });

  it("F restaurants do not pad indoor PLAY while valid indoor activities exist", () => {
    const out = deck("오늘 실내에서 놀까?");
    expect(out.deck).toHaveLength(3);
    expect(out.deck.every((d) => d.card.category === "activity")).toBe(true);
    expect(out.deck.some((d) => d.card.category === "restaurant" || d.card.category === "cafe")).toBe(false);
    expect(out.deck.map((d) => d.card.name)).not.toEqual(expect.arrayContaining(["남도연프리미엄", "능이밥상 오산직영점"]));
  });

  it("G valid indoor activities remain eligible", () => {
    expect(hasCredibleIndoorPlayEvidence(toDiscoveryItem(BOARD, 70))).toBe(true);
    expect(hasCredibleIndoorPlayEvidence(toDiscoveryItem(BOWLING, 68))).toBe(true);
    expect(hasCredibleIndoorPlayEvidence(toDiscoveryItem(ESCAPE, 66))).toBe(true);
    const names = deck("오늘 실내에서 놀까?").deck.map((d) => d.card.name);
    expect(names).toEqual(["보드게임카페 레드버튼", "볼링장", "방탈출카페"]);
  });

  it("does not drop indoor activities below the mixed top-80 band", () => {
    const parsed = parseScenarioIntent("오늘 실내에서 놀까?");
    const restaurants = Array.from({ length: 80 }, (_, i) =>
      scored(
        card({
          id: `food-pad-${i}`,
          name: `식당패딩${i}`,
          category: "restaurant",
          tags: ["한식"],
        }),
        90 - i * 0.01
      )
    );
    const out = finalizeRecommendations({
      query: "오늘 실내에서 놀까?",
      parsed,
      ranked: restaurants.slice(0, 3),
      scoredPool: [...restaurants, scored(BOARD, 8), scored(BOWLING, 7), scored(ESCAPE, 6)],
      deckSize: 3,
    });
    expect(out.deck).toHaveLength(3);
    expect(out.deck.map((d) => d.card.name)).toEqual(["보드게임카페 레드버튼", "볼링장", "방탈출카페"]);
  });

  it("does not pad indoor PLAY to 3 with restaurants when only one indoor activity exists", () => {
    const parsed = parseScenarioIntent("오늘 실내에서 놀까?");
    const out = finalizeRecommendations({
      query: "오늘 실내에서 놀까?",
      parsed,
      ranked: [scored(NAMDO, 90), scored(NEUNGI, 88), scored(PARK, 86)],
      scoredPool: [scored(NAMDO, 90), scored(NEUNGI, 88), scored(PARK, 86), scored(BOARD, 40)],
      deckSize: 3,
    });
    expect(out.deck).toHaveLength(1);
    expect(out.deck[0]?.card.name).toBe("보드게임카페 레드버튼");
  });

  it("Home indoor candidate query reaches PLAY without implying child", () => {
    const q = getHomeSituationCandidate("indoor")!.query;
    const urlQ = new URLSearchParams(resolveHomeResultsUrl(q).split("?")[1] ?? "").get("q");
    expect(urlQ).toBe(q);
    const { parsed, classification } = classify(q);
    expect(classification.role).toBe("PLAY");
    expect(parsed.withKids).not.toBe(true);
    expect(isExplicitKidsRecommendationContext(parsed)).toBe(false);
  });

  it("generic indoor PLAY omits holdem/poker when ordinary indoor play exists", () => {
    const homeQ = getHomeSituationCandidate("indoor")!.query;
    expect(shouldHideHoldemPokerForGenericIndoorPlay(homeQ, parseScenarioIntent(homeQ))).toBe(true);
    expect(isHoldemPokerCodedVenue(toDiscoveryItem(HOLDEM, 99))).toBe(true);
    const parsed = parseScenarioIntent(homeQ);
    const out = finalizeRecommendations({
      query: homeQ,
      parsed,
      ranked: [scored(HOLDEM, 99), scored(BOARD, 70), scored(BOWLING, 68)],
      scoredPool: [scored(HOLDEM, 99), scored(BOARD, 70), scored(BOWLING, 68), scored(ESCAPE, 66)],
      deckSize: 3,
    });
    expect(out.deck.map((d) => d.card.name)).not.toContain("홀덤펍보드카페");
    expect(out.deck).toHaveLength(3);
    expect(out.deck.every((d) => d.card.category === "activity")).toBe(true);
    expect(out.deck.some((d) => d.card.category === "restaurant")).toBe(false);
  });

  it("explicit holdem/poker queries keep holdem venues eligible", () => {
    for (const q of ["홀덤 하고 싶어", "홀덤펍 추천해줘", "포커 할 곳", "포커펍 찾아줘"]) {
      expect(isExplicitHoldemPokerQuery(q)).toBe(true);
      expect(shouldHideHoldemPokerForGenericIndoorPlay(q, parseScenarioIntent(q))).toBe(false);
      const parsed = parseScenarioIntent(q);
      const out = finalizeRecommendations({
        query: q,
        parsed,
        ranked: [scored(HOLDEM, 99), scored(BOARD, 70), scored(BOWLING, 68)],
        scoredPool: [scored(HOLDEM, 99), scored(BOARD, 70), scored(BOWLING, 68)],
        deckSize: 3,
      });
      expect(out.deck.map((d) => d.card.name)).toContain("홀덤펍보드카페");
    }
  });
});
