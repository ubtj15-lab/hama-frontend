import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "../parseScenarioIntent";
import { generateCourses, collectCandidatesByType } from "../courseEngine";
import { resolveScenarioConfig } from "../resolveScenarioConfig";
import {
  filterNeutralDateActivityCandidates,
  isCourseHoldemPokerVenue,
  shouldSuppressHoldemForNeutralDateCourse,
} from "../courseHoldemPolicy";
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

function activityNamesInCourses(query: string, pool: HomeCard[] = productionStylePool): string[] {
  return dateCourses(query, pool).flatMap((plan) =>
    plan.stops.filter((s) => s.placeType === "ACTIVITY").map((s) => s.placeName)
  );
}

function holdemCountInDeck(query: string, pool: HomeCard[] = productionStylePool): number {
  const names = dateCourses(query, pool).flatMap((p) => p.stops.map((s) => s.placeName));
  return names.filter((n) => /홀덤|포커펍|포커/.test(n ?? "")).length;
}

describe("Course holdem policy helpers", () => {
  it("reuses existing helpers: holdem-coded vs lounge, explicit vs neutral", () => {
    expect(isCourseHoldemPokerVenue(holdemBoard)).toBe(true);
    expect(isCourseHoldemPokerVenue(holdemFriends)).toBe(true);
    expect(isCourseHoldemPokerVenue(lounge)).toBe(false);
    expect(isCourseHoldemPokerVenue(arcade)).toBe(false);
    expect(shouldSuppressHoldemForNeutralDateCourse(parseScenarioIntent("데이트 코스"))).toBe(true);
    expect(shouldSuppressHoldemForNeutralDateCourse(parseScenarioIntent("오늘 데이트 코스"))).toBe(true);
    expect(shouldSuppressHoldemForNeutralDateCourse(parseScenarioIntent("둘이 데이트 코스"))).toBe(true);
    expect(shouldSuppressHoldemForNeutralDateCourse(parseScenarioIntent("홀덤 데이트 코스"))).toBe(false);
    expect(shouldSuppressHoldemForNeutralDateCourse(parseScenarioIntent("홀덤펍 데이트"))).toBe(false);
    expect(shouldSuppressHoldemForNeutralDateCourse(parseScenarioIntent("포커펍 가는 데이트 코스"))).toBe(false);
    expect(shouldSuppressHoldemForNeutralDateCourse(parseScenarioIntent("가족 코스"))).toBe(false);
  });

  it("falls back to holdem ACTIVITY when no ordinary ACTIVITY remains", () => {
    const onlyHoldem = [holdemBoard, holdemFriends];
    const kept = filterNeutralDateActivityCandidates(onlyHoldem, parseScenarioIntent("데이트 코스"));
    expect(kept.map((c) => c.name)).toEqual(["홀덤펍보드카페", "프렌즈홀덤토너먼트경기장"]);
  });
});

describe("Neutral DATE course suppresses holdem", () => {
  it.each(["데이트 코스", "오늘 데이트 코스", "둘이 데이트 코스"])(
    "%s: holdem count is 0 and ACTIVITY role stays filled",
    (query) => {
      const obj = parseScenarioIntent(query);
      expect(obj.scenario).toBe("date");
      const plans = dateCourses(query);
      expect(plans.length).toBeGreaterThan(0);
      expect(holdemCountInDeck(query)).toBe(0);
      expect(activityNamesInCourses(query).some((n) => n === "홀덤펍보드카페" || n === "프렌즈홀덤토너먼트경기장")).toBe(
        false
      );
      const cfg = resolveScenarioConfig(obj);
      const byType = collectCandidatesByType(productionStylePool, cfg, { homeTab: "all", courseObj: obj });
      expect(byType.ACTIVITY.some((c) => isCourseHoldemPokerVenue(c))).toBe(false);
      expect(byType.ACTIVITY.length).toBeGreaterThan(0);
      expect(byType.ACTIVITY.some((c) => c.name === "레이킨라운지 오산운암점")).toBe(true);
    }
  );
});

describe("Explicit holdem DATE keeps holdem eligible", () => {
  it.each(["홀덤 데이트 코스", "홀덤펍 데이트", "포커펍 가는 데이트 코스"])(
    "%s: policy does not filter holdem ACTIVITY",
    (query) => {
      const obj = parseScenarioIntent(query);
      const cfg = resolveScenarioConfig(obj);
      const byType = collectCandidatesByType(productionStylePool, cfg, { homeTab: "all", courseObj: obj });
      const holdemEligible = byType.ACTIVITY.filter((c) => isCourseHoldemPokerVenue(c)).map((c) => c.name);
      expect(holdemEligible).toEqual(expect.arrayContaining(["홀덤펍보드카페", "프렌즈홀덤토너먼트경기장"]));
    }
  );
});

describe("Non-DATE course is unchanged", () => {
  it("family course still admits holdem ACTIVITY candidates", () => {
    const obj = parseScenarioIntent("가족 코스");
    expect(obj.scenario).not.toBe("date");
    const cfg = resolveScenarioConfig(obj);
    const byType = collectCandidatesByType(productionStylePool, cfg, { homeTab: "all", courseObj: obj });
    expect(byType.ACTIVITY.some((c) => c.name === "홀덤펍보드카페")).toBe(true);
  });
});
