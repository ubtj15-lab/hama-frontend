import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "../parseScenarioIntent";
import { generateCourses, collectCandidatesByType } from "../courseEngine";
import { resolveScenarioConfig } from "../resolveScenarioConfig";
import { isExcludedFromHamaV1UserCatalog } from "@/lib/recommend/hamaV1UserCatalog";
import type { HomeCard } from "@/lib/storeTypes";

function card(id: string, category: string, name?: string, extra: Partial<HomeCard> = {}): HomeCard {
  return { id, name: name ?? id, category, tags: [], mood: [], ...extra };
}

const holdemBoard = card("holdem-board", "activity", "홀덤펍보드카페");
const holdemFriends = card("holdem-friends", "activity", "프렌즈홀덤토너먼트경기장");
const arcade = card("arcade-x", "activity", "아케이드엑스 오산동탄점");
const bounce = card("bounce", "activity", "바운스테마파크 오산점");
const lounge = card("raykin", "activity", "레이킨라운지 오산운암점");
const food = card("food-a", "restaurant", "돌고래마차");
const cafe = card("cafe-a", "cafe", "송강커피");

const productionStylePool: HomeCard[] = [
  food,
  cafe,
  holdemBoard,
  holdemFriends,
  arcade,
  bounce,
  lounge,
  card("walk-a", "park", "운암제1근린공원"),
];

function dateCourses(query: string, pool: HomeCard[] = productionStylePool) {
  const obj = parseScenarioIntent(query);
  const cfg = resolveScenarioConfig(obj);
  return generateCourses(pool, obj, cfg, 3, { homeTab: "all" });
}

function holdemCountInDeck(query: string, pool: HomeCard[] = productionStylePool): number {
  const names = dateCourses(query, pool).flatMap((p) => p.stops.map((s) => s.placeName));
  return names.filter((n) => /홀덤|포커펍|포커/.test(n ?? "")).length;
}

describe("HAMA V1 course catalog exclusion", () => {
  it("central policy marks known holdem venues and keeps ordinary ACTIVITY", () => {
    expect(isExcludedFromHamaV1UserCatalog(holdemBoard)).toBe(true);
    expect(isExcludedFromHamaV1UserCatalog(holdemFriends)).toBe(true);
    expect(isExcludedFromHamaV1UserCatalog(lounge)).toBe(false);
    expect(isExcludedFromHamaV1UserCatalog(arcade)).toBe(false);
  });

  it.each(["데이트 코스", "오늘 데이트 코스", "둘이 데이트 코스", "홀덤 데이트 코스", "포커펍 가는 데이트 코스"])(
    "%s: holdem count is 0 and ordinary ACTIVITY remains",
    (query) => {
      const obj = parseScenarioIntent(query);
      const plans = dateCourses(query);
      expect(plans.length).toBeGreaterThan(0);
      expect(holdemCountInDeck(query)).toBe(0);
      const cfg = resolveScenarioConfig(obj);
      const byType = collectCandidatesByType(productionStylePool, cfg, { homeTab: "all", courseObj: obj });
      expect(byType.ACTIVITY.some((c) => isExcludedFromHamaV1UserCatalog(c))).toBe(false);
      expect(byType.ACTIVITY.length).toBeGreaterThan(0);
      expect(byType.ACTIVITY.some((c) => c.name === "레이킨라운지 오산운암점")).toBe(true);
    }
  );

  it("family course also excludes holdem ACTIVITY", () => {
    const obj = parseScenarioIntent("가족 코스");
    const cfg = resolveScenarioConfig(obj);
    const byType = collectCandidatesByType(productionStylePool, cfg, { homeTab: "all", courseObj: obj });
    expect(byType.ACTIVITY.some((c) => c.name === "홀덤펍보드카페")).toBe(false);
    expect(byType.ACTIVITY.some((c) => c.name === "레이킨라운지 오산운암점")).toBe(true);
  });
});
