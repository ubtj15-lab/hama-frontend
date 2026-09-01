import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { finalizeRecommendations, isExplicitKidsRecommendationContext } from "../finalizeRecommendations";
import { isHighConfidenceAdultVenueHaystack } from "../childFriendlyScore";
import {
  DEFAULT_LOCAL_MAX_KM,
  EXPLICIT_NEARBY_MAX_KM,
  exceedsLocalDistanceCap,
  resolveLocalDistanceCapKm,
} from "../localDistanceSafety";
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

const RANGE = card({
  id: "bangbros-range",
  name: "뱅브로스 실내사격장",
  category: "activity",
  distanceKm: 39.1,
});
const NEAR_CAFE = card({
  id: "near-cafe",
  name: "오산가까운카페",
  category: "cafe",
  distanceKm: 10,
});
const MID_CAFE = card({
  id: "mid-cafe",
  name: "세마카페",
  category: "cafe",
  distanceKm: 6.2,
});
const CLOSE_FOOD = card({
  id: "close-food",
  name: "오산국밥",
  category: "restaurant",
  distanceKm: 2.4,
});
const CLOSE_WALK = card({
  id: "close-walk",
  name: "오산호수공원",
  category: "activity",
  distanceKm: 3.1,
});
const HEADS_UP = card({
  id: "6bcfa8ae-853c-4437-a811-b860205cb07a",
  name: "헤즈업홀덤펍 동탄점",
  category: "activity",
  distanceKm: 2,
});
const KIDS_PLAY = card({
  id: "kids-play-1",
  name: "나만의 키즈카페",
  category: "activity",
  tags: ["키즈카페", "실내", "놀이"],
  with_kids: true,
  distanceKm: 4,
});

function run(query: string, pool: ScoredRecommendItem[], deckSize = 3) {
  const parsed = parseScenarioIntent(query);
  const ranked = [...pool].sort(
    (a, b) => (b.breakdown.finalScore ?? 0) - (a.breakdown.finalScore ?? 0)
  );
  return finalizeRecommendations({
    query,
    parsed,
    ranked,
    scoredPool: pool,
    deckSize,
  });
}

describe("local distance policy units", () => {
  it("caps ordinary local at 15km and nearby at 5km", () => {
    expect(resolveLocalDistanceCapKm("데이트")).toBe(DEFAULT_LOCAL_MAX_KM);
    expect(resolveLocalDistanceCapKm("아이랑 갈만한 곳")).toBe(DEFAULT_LOCAL_MAX_KM);
    expect(resolveLocalDistanceCapKm("가까운 곳")).toBe(EXPLICIT_NEARBY_MAX_KM);
    expect(resolveLocalDistanceCapKm("근처 카페")).toBe(EXPLICIT_NEARBY_MAX_KM);
    expect(resolveLocalDistanceCapKm("드라이브 갈 곳")).toBeNull();
  });

  it("does not treat missing distance as over-cap", () => {
    expect(
      exceedsLocalDistanceCap({ distanceKm: null, query: "데이트", placeName: "어딘가" })
    ).toBe(false);
  });
});

describe("local distance eligibility in finalizeRecommendations", () => {
  it("A: ordinary local excludes a 39.1km candidate", () => {
    const out = run("데이트", [
      scored(RANGE, 99),
      scored(NEAR_CAFE, 80),
      scored(CLOSE_FOOD, 70),
    ]);
    expect(out.deck.map((d) => d.card.id)).not.toContain("bangbros-range");
    expect(out.eligiblePool.map((d) => d.card.id)).not.toContain("bangbros-range");
  });

  it("B: ordinary local keeps a 10km candidate", () => {
    const out = run("카페 가고 싶어", [
      scored(NEAR_CAFE, 90),
      scored(CLOSE_FOOD, 80),
      scored(CLOSE_WALK, 70),
    ]);
    expect(out.eligiblePool.map((d) => d.card.id)).toContain("near-cafe");
    expect(out.deck.map((d) => d.card.id)).toContain("near-cafe");
  });

  it("C: explicit nearby excludes candidates over 5km", () => {
    const out = run("가까운 곳", [
      scored(MID_CAFE, 95),
      scored(CLOSE_FOOD, 80),
      scored(CLOSE_WALK, 70),
    ]);
    expect(out.eligiblePool.map((d) => d.card.id)).not.toContain("mid-cafe");
    expect(out.deck.map((d) => d.card.id)).not.toContain("mid-cafe");
    expect(out.deck.map((d) => d.card.id)).toEqual(expect.arrayContaining(["close-food", "close-walk"]));
  });

  it("D: expanded drive/travel is not excluded by the 15km default guard", () => {
    const out = run("드라이브 갈 곳", [
      scored(RANGE, 99),
      scored(NEAR_CAFE, 80),
      scored(CLOSE_FOOD, 70),
    ]);
    expect(out.eligiblePool.map((d) => d.card.id)).toContain("bangbros-range");
    expect(out.deck[0]?.card.id).toBe("bangbros-range");
  });

  it("D2: 여행 and 멀리 가도 돼 keep far candidates", () => {
    expect(run("여행", [scored(RANGE, 90)]).eligiblePool.map((d) => d.card.id)).toContain("bangbros-range");
    expect(run("멀리 가도 돼", [scored(RANGE, 90)]).eligiblePool.map((d) => d.card.id)).toContain(
      "bangbros-range"
    );
  });

  it("E: named/direct place lookup is not removed by the local cap", () => {
    const out = run("뱅브로스 실내사격장 찾아줘", [
      scored(RANGE, 99),
      scored(NEAR_CAFE, 80),
      scored(CLOSE_FOOD, 70),
    ]);
    expect(out.eligiblePool.map((d) => d.card.id)).toContain("bangbros-range");
    expect(out.deck.map((d) => d.card.id)).toContain("bangbros-range");
  });

  it("F: does not backfill TOP3 with a far third when only two are in cap", () => {
    const out = run("오늘 뭐하지", [
      scored(CLOSE_FOOD, 90),
      scored(CLOSE_WALK, 80),
      scored(RANGE, 99),
    ]);
    expect(out.deck).toHaveLength(2);
    expect(out.deck.map((d) => d.card.id).sort()).toEqual(["close-food", "close-walk"]);
    expect(out.deck.map((d) => d.card.id)).not.toContain("bangbros-range");
  });

  it("G: P1 kids/adult venue safety is unchanged with distance present", () => {
    const query = "아이랑 갈만한 곳";
    const parsed = parseScenarioIntent(query);
    expect(isExplicitKidsRecommendationContext(parsed)).toBe(true);
    expect(isHighConfidenceAdultVenueHaystack("헤즈업홀덤펍 동탄점 activity")).toBe(true);
    const out = run(query, [scored(HEADS_UP, 99), scored(KIDS_PLAY, 70), scored(CLOSE_FOOD, 60)]);
    expect(out.eligiblePool.map((d) => d.card.id)).not.toContain(HEADS_UP.id);
    expect(out.deck.map((d) => d.card.id)).not.toContain(HEADS_UP.id);
    expect(out.deck.some((d) => d.card.id === "kids-play-1")).toBe(true);
  });
});

const FAR_UNRELATED = card({
  id: "far-unrelated-cafe",
  name: "동탄먼카페",
  category: "cafe",
  distanceKm: 39.1,
});

describe("named lookup is candidate-specific; generic 찾아줘 stays capped", () => {
  it("keeps a 15km cap on generic 찾아줘 queries", () => {
    expect(resolveLocalDistanceCapKm("카페 찾아줘")).toBe(DEFAULT_LOCAL_MAX_KM);
    expect(resolveLocalDistanceCapKm("맛집 찾아줘")).toBe(DEFAULT_LOCAL_MAX_KM);
    expect(resolveLocalDistanceCapKm("데이트 장소 찾아줘")).toBe(DEFAULT_LOCAL_MAX_KM);
    expect(resolveLocalDistanceCapKm("아이들 놀 곳 찾아줘")).toBe(DEFAULT_LOCAL_MAX_KM);
    expect(resolveLocalDistanceCapKm("아이랑 갈 데 찾아줘")).toBe(DEFAULT_LOCAL_MAX_KM);
    expect(resolveLocalDistanceCapKm("근처 카페 찾아줘")).toBe(EXPLICIT_NEARBY_MAX_KM);
  });

  it("A: 카페 찾아줘 excludes a 39.1km candidate", () => {
    const out = run("카페 찾아줘", [scored(FAR_UNRELATED, 99), scored(CLOSE_FOOD, 70)]);
    expect(out.eligiblePool.map((d) => d.card.id)).not.toContain("far-unrelated-cafe");
  });

  it("B: 맛집 찾아줘 excludes a 39.1km candidate", () => {
    const out = run("맛집 찾아줘", [scored(RANGE, 99), scored(CLOSE_FOOD, 70)]);
    expect(out.eligiblePool.map((d) => d.card.id)).not.toContain("bangbros-range");
  });

  it("C: 아이랑 갈 데 찾아줘 excludes a 39.1km candidate", () => {
    const out = run("아이랑 갈 데 찾아줘", [scored(RANGE, 99), scored(KIDS_PLAY, 70)]);
    expect(out.eligiblePool.map((d) => d.card.id)).not.toContain("bangbros-range");
  });

  it("D: 근처 카페 찾아줘 applies the 5km nearby cap", () => {
    const out = run("근처 카페 찾아줘", [scored(MID_CAFE, 95), scored(CLOSE_FOOD, 80)]);
    expect(out.eligiblePool.map((d) => d.card.id)).not.toContain("mid-cafe");
    expect(out.eligiblePool.map((d) => d.card.id)).toContain("close-food");
  });

  it("E: matching 뱅브로스 실내사격장 찾아줘 may keep that far candidate", () => {
    const out = run("뱅브로스 실내사격장 찾아줘", [scored(RANGE, 99), scored(CLOSE_FOOD, 70)]);
    expect(out.eligiblePool.map((d) => d.card.id)).toContain("bangbros-range");
  });

  it("F: the same named query does not uncap an unrelated far candidate", () => {
    const out = run("뱅브로스 실내사격장 찾아줘", [scored(RANGE, 99), scored(FAR_UNRELATED, 98)]);
    expect(out.eligiblePool.map((d) => d.card.id)).toContain("bangbros-range");
    expect(out.eligiblePool.map((d) => d.card.id)).not.toContain("far-unrelated-cafe");
  });

  it("G: 뱅브로스 실내사격장 위치 still exempts only the matching candidate", () => {
    const out = run("뱅브로스 실내사격장 위치", [scored(RANGE, 99), scored(FAR_UNRELATED, 90)]);
    expect(out.eligiblePool.map((d) => d.card.id)).toContain("bangbros-range");
    expect(out.eligiblePool.map((d) => d.card.id)).not.toContain("far-unrelated-cafe");
  });

  it("H: expanded-distance 드라이브 still keeps a far candidate", () => {
    const out = run("드라이브 갈 곳", [scored(RANGE, 99), scored(CLOSE_FOOD, 70)]);
    expect(out.eligiblePool.map((d) => d.card.id)).toContain("bangbros-range");
  });

  it("I: ordinary local 10km remains eligible", () => {
    const out = run("카페 가고 싶어", [scored(NEAR_CAFE, 90), scored(CLOSE_FOOD, 80)]);
    expect(out.eligiblePool.map((d) => d.card.id)).toContain("near-cafe");
  });

  it("J: only two nearby candidates are returned; no far third backfill", () => {
    const out = run("오늘 뭐하지", [scored(CLOSE_FOOD, 90), scored(CLOSE_WALK, 80), scored(RANGE, 99)]);
    expect(out.deck).toHaveLength(2);
    expect(out.deck.map((d) => d.card.id).sort()).toEqual(["close-food", "close-walk"]);
  });
});
