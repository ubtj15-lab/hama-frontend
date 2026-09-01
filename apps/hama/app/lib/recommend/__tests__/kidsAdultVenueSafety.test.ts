import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { classifyDiscoveryQuery } from "../discoveryRole";
import { finalizeRecommendations, isExplicitKidsRecommendationContext } from "../finalizeRecommendations";
import {
  isAlcoholNightlifeHaystack,
  isHighConfidenceAdultVenueHaystack,
  shouldBlockKidFriendlyMessaging,
} from "../childFriendlyScore";
import { buildRecommendationReason } from "../buildRecommendationReason";
import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendScoreBreakdown, ScoredRecommendItem } from "../scoring";

function card(partial: Partial<HomeCard> & Pick<HomeCard, "id" | "name" | "category">): HomeCard {
  return {
    lat: 37.2009,
    lng: 127.0957,
    area: null,
    address: null,
    image_url: null,
    mood: ["가벼운활동"],
    tags: ["기본", "보통", "액티비티"],
    description: null,
    updated_at: null,
    with_kids: false,
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

const HEADS_UP = card({
  id: "6bcfa8ae-853c-4437-a811-b860205cb07a",
  name: "헤즈업홀덤펍 동탄점",
  category: "activity",
});
const HOLDEM_BOARD = card({
  id: "0d57cfc4-081c-4192-b66d-d8eddba22782",
  name: "홀덤펍보드카페",
  category: "activity",
});
const HOLDEM_TOURNAMENT = card({
  id: "129dd782-429f-44b9-b6d5-453d35aa2fbf",
  name: "프렌즈홀덤토너먼트경기장",
  category: "activity",
});

const KIDS_PLAY = card({
  id: "kids-play-1",
  name: "나만의 키즈카페",
  category: "activity",
  tags: ["키즈카페", "실내", "놀이"],
  with_kids: true,
});
const KIDS_PLAY_2 = card({
  id: "kids-play-2",
  name: "챔피언더에너자이저",
  category: "activity",
  tags: ["키즈", "실내"],
  with_kids: true,
});
const CAFE = card({ id: "cafe-1", name: "디허케이크룸", category: "cafe", mood: [], tags: [] });

const HOLDEM_FIXTURES = [HEADS_UP, HOLDEM_BOARD, HOLDEM_TOURNAMENT];

function run(query: string, extra: HomeCard[] = []) {
  const parsed = parseScenarioIntent(query);
  const holdemScored = HOLDEM_FIXTURES.map((c, i) => scored(c, 95 - i));
  const kidsScored = [scored(KIDS_PLAY, 60), scored(KIDS_PLAY_2, 58), scored(CAFE, 55)];
  const extras = extra.map((c, i) => scored(c, 50 - i));
  const pool = [...holdemScored, ...kidsScored, ...extras];
  const out = finalizeRecommendations({
    query,
    parsed,
    ranked: holdemScored,
    scoredPool: pool,
    deckSize: 3,
  });
  return { parsed, out };
}

function holdemIdsIn(items: ScoredRecommendItem[]): string[] {
  const ids = new Set(HOLDEM_FIXTURES.map((c) => c.id));
  return items.filter((d) => ids.has(d.card.id)).map((d) => d.card.id);
}

describe("high-confidence adult venue classification", () => {
  it("detects the three catalog holdem/activity venues", () => {
    expect(isHighConfidenceAdultVenueHaystack("헤즈업홀덤펍 동탄점 activity")).toBe(true);
    expect(isHighConfidenceAdultVenueHaystack("홀덤펍보드카페 activity")).toBe(true);
    expect(isHighConfidenceAdultVenueHaystack("프렌즈홀덤토너먼트경기장 activity")).toBe(true);
  });

  it("does not treat ASCII-only 펍\\b as sufficient — Korean 홀덤펍 is caught by the new helper", () => {
    expect(isAlcoholNightlifeHaystack("헤즈업홀덤펍 동탄점")).toBe(false);
    expect(isHighConfidenceAdultVenueHaystack("헤즈업홀덤펍 동탄점")).toBe(true);
  });

  it("does not classify ambiguous non-pub names from raw 바/술/와인", () => {
    expect(isHighConfidenceAdultVenueHaystack("와이노 동탄")).toBe(false);
    expect(isHighConfidenceAdultVenueHaystack("야키토리잔잔")).toBe(false);
    expect(isHighConfidenceAdultVenueHaystack("빈대떡에얼음막걸리")).toBe(false);
  });

  it("blocks Results kid-friendly messaging for holdem activity", () => {
    expect(shouldBlockKidFriendlyMessaging(HEADS_UP)).toBe(true);
    const reason = buildRecommendationReason(HEADS_UP, { requestedScenario: "family" });
    expect(reason.headline).not.toMatch(/아이와 함께|아이랑 가기|아이 동반/);
  });
});

describe("kids-context adult venue filter", () => {
  const kidsQueries = [
    "아이랑 갈만한 곳",
    "아이들이랑 어디 가지?",
    "아이들이랑 실내에서 놀 만한 데 없어?",
    "아이랑 체험할 곳",
    "키즈카페 추천해줘",
  ];

  it.each(kidsQueries)("excludes all three holdem venues for: %s", (query) => {
    const { parsed, out } = run(query);
    expect(isExplicitKidsRecommendationContext(parsed)).toBe(true);
    expect(holdemIdsIn(out.eligiblePool)).toEqual([]);
    expect(holdemIdsIn(out.deck)).toEqual([]);
  });
});

describe("non-kids controls remain eligible", () => {
  const controls = ["홀덤펍 찾아줘", "오늘 밤 놀 곳", "친구들이랑 놀 곳"];

  it.each(controls)("does not globally drop holdem for: %s", (query) => {
    const { parsed, out } = run(query);
    expect(parsed.withKids).not.toBe(true);
    expect(isExplicitKidsRecommendationContext(parsed)).toBe(false);
    expect(holdemIdsIn(out.eligiblePool).length).toBe(3);
  });
});

describe("bare family does not trigger the strong kids guard", () => {
  it("가족끼리 놀러 갈 곳 does not activate explicit-kids exclusion by 가족 alone", () => {
    const q = "가족끼리 놀러 갈 곳";
    const { parsed, out } = run(q);
    expect(parsed.withKids).not.toBe(true);
    expect(parsed.queryUnderstanding?.companionIntents ?? []).not.toContain("child");
    expect(parsed.queryUnderstanding?.purposeIntents ?? []).not.toEqual(
      expect.arrayContaining(["kids_cafe", "indoor_play"])
    );
    expect(isExplicitKidsRecommendationContext(parsed)).toBe(false);
    expect(holdemIdsIn(out.eligiblePool).length).toBe(3);
  });
});

describe("P1 indoor-play regression", () => {
  it("keeps PLAY + kids-play candidates and no holdem in TOP3", () => {
    const q = "아이들이랑 실내에서 놀 만한 데 없어?";
    const { parsed, out } = run(q);
    expect(parsed.withKids).toBe(true);
    expect(parsed.indoorPreferred).toBe(true);
    expect(classifyDiscoveryQuery(q, parsed).role).toBe("PLAY");
    expect(out.classification.role).toBe("PLAY");
    expect(holdemIdsIn(out.deck)).toEqual([]);
    expect(out.deck.some((d) => /키즈/.test(`${d.card.name} ${(d.card.tags ?? []).join(" ")}`))).toBe(true);
    expect(out.deck.every((d) => d.card.category !== "restaurant")).toBe(true);
  });
});
