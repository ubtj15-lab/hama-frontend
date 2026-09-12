import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { collectCandidatesByType, generateCourses } from "@/lib/scenarioEngine/courseEngine";
import { resolveScenarioConfig } from "@/lib/scenarioEngine/resolveScenarioConfig";
import { finalizeRecommendations } from "../finalizeRecommendations";
import { filterHamaV1UserCatalog, isExcludedFromHamaV1UserCatalog } from "../hamaV1UserCatalog";
import { isHoldemPokerCodedVenue, toDiscoveryItem } from "../discoveryRole";
import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendScoreBreakdown, ScoredRecommendItem } from "../scoring";
import {
  EMPTY_COURSE_REPEAT_AVOIDANCE,
  orderedCourseSignature,
  unorderedCourseSignature,
  type CourseRepeatAvoidance,
} from "@/lib/results/courseRepeat";

function card(id: string, category: string, name?: string, extra: Partial<HomeCard> = {}): HomeCard {
  return { id, name: name ?? id, category, tags: extra.tags ?? [], mood: extra.mood ?? [], ...extra };
}

function scored(c: HomeCard, finalScore: number): ScoredRecommendItem {
  return {
    card: c,
    reasonText: "",
    reasonVoice: "solo",
    breakdown: { finalScore } as RecommendScoreBreakdown,
  };
}

const holdemBoard = card("holdem-board", "activity", "홀덤펍보드카페", {
  tags: ["홀덤", "보드카페"],
  description: "홀덤펍",
});
const holdemFriends = card("holdem-friends", "activity", "프렌즈홀덤토너먼트경기장");
const holdemHeads = card("heads-up", "activity", "헤즈업홀덤펍 동탄점");
const arcade = card("arcade-x", "activity", "아케이드엑스 오산동탄점", { tags: ["실내", "오락실"] });
const bounce = card("bounce", "activity", "바운스테마파크 오산점", { tags: ["실내", "키즈"] });
const lounge = card("raykin", "activity", "레이킨라운지 오산운암점");
const bowling = card("bowling", "activity", "오산볼링센터", { tags: ["실내", "볼링"] });
const board = card("board", "activity", "보드게임카페 레드버튼", { tags: ["실내", "보드게임"] });
const food = card("food-a", "restaurant", "돌고래마차");
const foodB = card("food-b", "restaurant", "와다이");
const cafe = card("cafe-a", "cafe", "송강커피");
const cafeB = card("cafe-b", "cafe", "그래이스그래니");
const walk = card("walk-a", "park", "운암제1근린공원");

const HOLDEM_VENUES = [holdemBoard, holdemFriends, holdemHeads];
const productionStylePool: HomeCard[] = [
  food,
  foodB,
  cafe,
  cafeB,
  holdemBoard,
  holdemFriends,
  holdemHeads,
  arcade,
  bounce,
  lounge,
  bowling,
  board,
  walk,
];

const USER_FACING_QUERIES = [
  "데이트 코스",
  "오늘 데이트 코스",
  "실내에서 놀 곳",
  "뭐 하지",
  "액티비티",
  "홀덤",
  "홀덤펍",
  "포커",
  "포커펍",
  "데이트",
];

function holdemNameCount(names: readonly (string | null | undefined)[]): number {
  return names.filter((n) => /홀덤|포커펍|포커/.test(n ?? "")).length;
}

function recommendHoldemCount(query: string): { deck: number; pool: number; ordinaryRemain: boolean } {
  const parsed = parseScenarioIntent(query);
  const holdemScored = HOLDEM_VENUES.map((c, i) => scored(c, 99 - i));
  const ordinary = [scored(board, 80), scored(bowling, 78), scored(arcade, 76), scored(food, 70), scored(cafe, 68)];
  const out = finalizeRecommendations({
    query,
    parsed,
    ranked: [...holdemScored, ...ordinary],
    scoredPool: [...holdemScored, ...ordinary],
    deckSize: 3,
  });
  return {
    deck: holdemNameCount(out.deck.map((d) => d.card.name)),
    pool: holdemNameCount(out.eligiblePool.map((d) => d.card.name)),
    ordinaryRemain: out.deck.some((d) => ["보드게임카페 레드버튼", "오산볼링센터", "아케이드엑스 오산동탄점", "돌고래마차", "송강커피"].includes(d.card.name)),
  };
}

describe("HAMA V1 user catalog eligibility", () => {
  it("reuses isHoldemPokerCodedVenue for known holdem venues and keeps ordinary venues", () => {
    expect(isHoldemPokerCodedVenue(toDiscoveryItem(holdemBoard, 0))).toBe(true);
    expect(isExcludedFromHamaV1UserCatalog(holdemBoard)).toBe(true);
    expect(isExcludedFromHamaV1UserCatalog(holdemFriends)).toBe(true);
    expect(isExcludedFromHamaV1UserCatalog(holdemHeads)).toBe(true);
    expect(isExcludedFromHamaV1UserCatalog({ name: "홀덤펍보드카페", tags: ["보드게임"] })).toBe(true);
    expect(isExcludedFromHamaV1UserCatalog(lounge)).toBe(false);
    expect(isExcludedFromHamaV1UserCatalog(arcade)).toBe(false);
    expect(isExcludedFromHamaV1UserCatalog(food)).toBe(false);
    expect(filterHamaV1UserCatalog(productionStylePool).map((c) => c.name)).not.toEqual(
      expect.arrayContaining(["홀덤펍보드카페", "프렌즈홀덤토너먼트경기장", "헤즈업홀덤펍 동탄점"])
    );
    expect(filterHamaV1UserCatalog(productionStylePool).some((c) => c.name === "레이킨라운지 오산운암점")).toBe(true);
  });

  it("detects holdem from normalized tags, not only the display name", () => {
    const tagged = card("hidden-holdem", "activity", "동탄보드라운지", { tags: ["홀덤펍"], mood: ["포커"] });
    expect(isExcludedFromHamaV1UserCatalog(tagged)).toBe(true);
    expect(isExcludedFromHamaV1UserCatalog(card("ok", "activity", "동탄보드라운지", { tags: ["보드게임"] }))).toBe(
      false
    );
  });
});

describe("user-facing recommendation / Home / Results exposure", () => {
  it.each(USER_FACING_QUERIES)("%s: zero holdem in deck and eligible pool", (query) => {
    const { deck, pool, ordinaryRemain } = recommendHoldemCount(query);
    expect(deck).toBe(0);
    expect(pool).toBe(0);
    expect(ordinaryRemain).toBe(true);
  });
});

describe("Course engine uses the central HAMA V1 policy", () => {
  it("filters holdem before the 24 typed cap so they do not consume ACTIVITY slots", () => {
    const filler = Array.from({ length: 24 }, (_, i) =>
      card(`act-${i}`, "activity", `실내액티비티${i + 1}`, { tags: ["실내"] })
    );
    const pool = [holdemBoard, holdemFriends, ...filler];
    const obj = parseScenarioIntent("데이트 코스");
    const cfg = resolveScenarioConfig(obj);
    const byType = collectCandidatesByType(pool, cfg, { homeTab: "all", maxPerType: 24, courseObj: obj });
    expect(byType.ACTIVITY).toHaveLength(24);
    expect(byType.ACTIVITY.every((c) => !isExcludedFromHamaV1UserCatalog(c))).toBe(true);
    expect(byType.ACTIVITY[0]?.name).toBe("실내액티비티1");
  });

  it.each(["데이트 코스", "오늘 데이트 코스", "홀덤", "홀덤펍", "포커펍", "가족 코스"])(
    "%s: course slots have zero holdem and ordinary FOOD/ACTIVITY/CAFE remain",
    (query) => {
      const obj = parseScenarioIntent(query);
      const cfg = resolveScenarioConfig(obj);
      const byType = collectCandidatesByType(productionStylePool, cfg, { homeTab: "all", courseObj: obj });
      expect(byType.ACTIVITY.some((c) => isExcludedFromHamaV1UserCatalog(c))).toBe(false);
      expect(byType.ACTIVITY.length).toBeGreaterThan(0);
      expect(byType.FOOD.length).toBeGreaterThan(0);
      expect(byType.CAFE.length).toBeGreaterThan(0);
      const plans = generateCourses(productionStylePool, obj, cfg, 3, { homeTab: "all" });
      expect(plans.length).toBeGreaterThan(0);
      const names = plans.flatMap((p) => p.stops.map((s) => s.placeName));
      expect(holdemNameCount(names)).toBe(0);
      expect(names.some((n) => n === "돌고래마차" || n === "와다이")).toBe(true);
    }
  );

  it("does not fall back to holdem when only holdem ACTIVITY remains", () => {
    const onlyHoldemActivity = [food, cafe, holdemBoard, holdemFriends];
    const obj = parseScenarioIntent("데이트 코스");
    const cfg = resolveScenarioConfig(obj);
    const byType = collectCandidatesByType(onlyHoldemActivity, cfg, { homeTab: "all", courseObj: obj });
    expect(byType.ACTIVITY).toEqual([]);
    const plans = generateCourses(onlyHoldemActivity, obj, cfg, 3, { homeTab: "all" });
    expect(holdemNameCount(plans.flatMap((p) => p.stops.map((s) => s.placeName)))).toBe(0);
  });

  it("데이트 코스 + 5 refresh rounds: holdem count across all visible Course slots is 0", () => {
    const obj = parseScenarioIntent("데이트 코스");
    const cfg = resolveScenarioConfig(obj);
    let avoid: CourseRepeatAvoidance = EMPTY_COURSE_REPEAT_AVOIDANCE;
    let holdem = 0;
    let sawOrdinary = false;
    for (let round = 0; round < 5; round += 1) {
      const plans = generateCourses(productionStylePool, obj, cfg, 3, { homeTab: "all", courseRepeat: avoid });
      expect(plans.length).toBeGreaterThan(0);
      const names = plans.flatMap((p) => p.stops.map((s) => s.placeName));
      holdem += holdemNameCount(names);
      if (names.some((n) => n === "돌고래마차" || n === "송강커피" || n === "레이킨라운지 오산운암점")) {
        sawOrdinary = true;
      }
      const placeIds = plans.flatMap((p) => p.stops.map((s) => s.placeId));
      avoid = {
        placeIds: [...new Set([...avoid.placeIds, ...placeIds])],
        orderedSignatures: [
          ...avoid.orderedSignatures,
          ...plans.map((p) => orderedCourseSignature(p.stops.map((s) => s.placeId))),
        ],
        unorderedSignatures: [
          ...avoid.unorderedSignatures,
          ...plans.map((p) => unorderedCourseSignature(p.stops.map((s) => s.placeId))),
        ],
      };
    }
    expect(holdem).toBe(0);
    expect(sawOrdinary).toBe(true);
  });
});
