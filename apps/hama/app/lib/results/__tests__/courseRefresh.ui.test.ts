import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { generateCourses } from "@/lib/scenarioEngine/courseEngine";
import { resolveScenarioConfig } from "@/lib/scenarioEngine/resolveScenarioConfig";
import { resolveOrdinaryRecommendationListVisible } from "../courseResultVisibility";
import type { HomeCard } from "@/lib/storeTypes";
import {
  COURSE_REFRESH_BUTTON_COPY,
  applyCourseRefreshClick,
  courseRepeatContextKey,
  orderedCourseSignature,
  recordDisplayedCoursePlans,
  shouldShowCourseRefreshButton,
  type CourseRepeatAvoidance,
} from "../courseRepeat";
import { REFRESH_BUTTON_COPY } from "@/_components/results/resultsPresentation";

function card(id: string, category: string, name?: string): HomeCard {
  return { id, name: name ?? id, category, tags: [], mood: [] };
}

function dateCourseObj() {
  return parseScenarioIntent("데이트 코스");
}

function installSessionStorage() {
  const memory = new Map<string, string>();
  const sessionStorage = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, String(v));
    },
    removeItem: (k: string) => {
      memory.delete(k);
    },
    clear: () => memory.clear(),
    key: (i: number) => [...memory.keys()][i] ?? null,
    get length() {
      return memory.size;
    },
  };
  vi.stubGlobal("window", { sessionStorage });
  return { memory, sessionStorage };
}

/** Mirrors results/page.tsx refreshCourseDeck + coursePlans useMemo. */
function clickOtherCourses(contextKey: string, version: number) {
  const click = applyCourseRefreshClick(contextKey);
  return {
    courseRepeatAvoid: click.courseRepeatAvoid,
    courseRefreshVersion: click.nextRefreshVersion(version),
  };
}

function generateDateCourses(pool: HomeCard[], avoid: CourseRepeatAvoidance, version: number) {
  void version;
  const obj = dateCourseObj();
  const cfg = resolveScenarioConfig(obj);
  return generateCourses(pool, obj, cfg, 3, { homeTab: "all", courseRepeat: avoid });
}

const equalScorePool: HomeCard[] = [
  card("food-seen", "restaurant", "돌고래마차"),
  card("food-alt", "restaurant", "와다이"),
  card("act-seen", "activity", "아케이드엑스 오산동탄점"),
  card("act-alt", "activity", "바운스테마파크 오산점"),
  card("act-alt-2", "activity", "레이킨라운지"),
  card("cafe-lead", "cafe", "송강커피"),
  card("cafe-alt", "cafe", "그래이스그래니"),
];

const tinyFallbackPool: HomeCard[] = [
  card("only-food", "restaurant"),
  card("only-cafe", "cafe"),
  card("only-act", "activity"),
];

describe("Course Repeat UI Integration V1", () => {
  beforeEach(() => {
    installSessionStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("A: valid Course mode shows 다른 코스 보기 and hides ordinary DATE list", () => {
    const showCourseDeck = true;
    expect(shouldShowCourseRefreshButton(showCourseDeck, 3)).toBe(true);
    expect(COURSE_REFRESH_BUTTON_COPY).toBe("다른 코스 보기");
    expect(COURSE_REFRESH_BUTTON_COPY).not.toBe(REFRESH_BUTTON_COPY);
    expect(
      resolveOrdinaryRecommendationListVisible({
        showCourseDeck,
        baseShowRecommendationList: false,
        forceSituationRecommendationListVisible: false,
        forceShowListByCards: true,
      })
    ).toBe(false);
  });

  it("B-F: actual click handler re-reads session, increments version, and rotates equal-score courses", () => {
    const obj = dateCourseObj();
    const contextKey = courseRepeatContextKey("데이트 코스", obj.scenario);
    expect(contextKey).toBe(`course|${String(obj.scenario ?? "").trim().toLowerCase()}|데이트 코스`);

    let courseRefreshVersion = 0;
    let courseRepeatAvoid: CourseRepeatAvoidance = applyCourseRefreshClick(contextKey).courseRepeatAvoid;
    expect(courseRepeatAvoid.placeIds).toEqual([]);

    const r1 = generateDateCourses(equalScorePool, courseRepeatAvoid, courseRefreshVersion);
    expect(r1.length).toBeGreaterThan(0);
    const r1ids = r1[0]!.stops.map((s) => s.placeId);
    const r1sig = orderedCourseSignature(r1ids);
    recordDisplayedCoursePlans(contextKey, r1.slice(0, 3));

    const click1 = clickOtherCourses(contextKey, courseRefreshVersion);
    courseRepeatAvoid = click1.courseRepeatAvoid;
    courseRefreshVersion = click1.courseRefreshVersion;
    expect(courseRefreshVersion).toBe(1);
    expect(courseRepeatAvoid.placeIds.length).toBeGreaterThan(0);
    expect(courseRepeatAvoid.placeIds).toEqual(expect.arrayContaining(r1ids));
    expect(courseRepeatAvoid.orderedSignatures).toContain(r1sig);

    const r2 = generateDateCourses(equalScorePool, courseRepeatAvoid, courseRefreshVersion);
    const r2ids = r2[0]!.stops.map((s) => s.placeId);
    const r2sig = orderedCourseSignature(r2ids);
    expect(r2sig).not.toBe(r1sig);
    recordDisplayedCoursePlans(contextKey, r2.slice(0, 3));

    const click2 = clickOtherCourses(contextKey, courseRefreshVersion);
    courseRepeatAvoid = click2.courseRepeatAvoid;
    courseRefreshVersion = click2.courseRefreshVersion;
    expect(courseRefreshVersion).toBe(2);
    expect(courseRepeatAvoid.placeIds).toEqual(expect.arrayContaining(r1ids));
    expect(courseRepeatAvoid.placeIds).toEqual(expect.arrayContaining(r2ids));
    expect(courseRepeatAvoid.orderedSignatures).toEqual(expect.arrayContaining([r1sig, r2sig]));

    const r3 = generateDateCourses(equalScorePool, courseRepeatAvoid, courseRefreshVersion);
    const r3ids = r3[0]!.stops.map((s) => s.placeId);
    const r3sig = orderedCourseSignature(r3ids);
    expect(r3sig).not.toBe(r1sig);
    expect(r3sig).not.toBe(r2sig);
    recordDisplayedCoursePlans(contextKey, r3.slice(0, 3));

    const click3 = clickOtherCourses(contextKey, courseRefreshVersion);
    courseRepeatAvoid = click3.courseRepeatAvoid;
    courseRefreshVersion = click3.courseRefreshVersion;
    expect(courseRefreshVersion).toBe(3);
    const r4 = generateDateCourses(equalScorePool, courseRepeatAvoid, courseRefreshVersion);
    expect(r4.length).toBeGreaterThan(0);
    expect(r4[0]?.stops.length).toBeGreaterThan(0);

    expect(window.sessionStorage.getItem("hama_course_repeat_v1")).toBeTruthy();
  });

  it("H: Course fallback keeps ordinary list and hides Course refresh CTA", () => {
    const showCourseDeck = false;
    expect(shouldShowCourseRefreshButton(showCourseDeck, 0)).toBe(false);
    expect(
      resolveOrdinaryRecommendationListVisible({
        showCourseDeck,
        baseShowRecommendationList: true,
        forceSituationRecommendationListVisible: false,
        forceShowListByCards: true,
      })
    ).toBe(true);

    const obj = dateCourseObj();
    const contextKey = courseRepeatContextKey("데이트 코스", obj.scenario);
    const r1 = generateDateCourses(tinyFallbackPool, applyCourseRefreshClick(contextKey).courseRepeatAvoid, 0);
    recordDisplayedCoursePlans(contextKey, r1.slice(0, 3));
    const click1 = clickOtherCourses(contextKey, 0);
    const r2 = generateDateCourses(tinyFallbackPool, click1.courseRepeatAvoid, click1.courseRefreshVersion);
    expect(r2.length).toBeGreaterThan(0);
    expect(r2[0]?.stops.length).toBeGreaterThan(0);
  });

  it("I + G: page wires Course CTA independently of ordinary DATE refresh", () => {
    const pageSrc = fs.readFileSync(
      path.resolve(__dirname, "../../../results/page.tsx"),
      "utf8"
    );
    const listSrc = fs.readFileSync(
      path.resolve(__dirname, "../../../_components/results/RecommendationList.tsx"),
      "utf8"
    );
    const visibilitySrc = fs.readFileSync(
      path.resolve(__dirname, "../courseResultVisibility.ts"),
      "utf8"
    );

    expect(pageSrc).toContain("COURSE_REFRESH_BUTTON_COPY");
    expect(pageSrc).toContain("applyCourseRefreshClick");
    expect(pageSrc).toContain("courseRefreshVersion");
    expect(pageSrc).toContain("shouldShowCourseRefreshButton");
    expect(pageSrc).toContain("setCourseRepeatAvoid(next.courseRepeatAvoid)");
    expect(pageSrc).toContain("setCourseRefreshVersion(next.nextRefreshVersion)");
    expect(pageSrc).toMatch(/courseRepeat:\s*courseRepeatAvoid/);
    expect(pageSrc).toContain("courseRefreshVersion");
    expect(pageSrc).toContain("rejectMainAndRefresh");
    expect(pageSrc).toContain("resolveOrdinaryRecommendationListVisible");
    expect(pageSrc).toContain("showCourseDeck");
    expect(pageSrc).not.toMatch(/showCourseDeck[\s\S]{0,80}<RecommendationList/);

    expect(listSrc).toContain("REFRESH_BUTTON_COPY");
    expect(listSrc).toContain("onRejectRecommendation");
    expect(listSrc).not.toContain("COURSE_REFRESH_BUTTON_COPY");
    expect(listSrc).not.toContain("다른 코스 보기");

    expect(visibilitySrc).toContain("if (input.showCourseDeck) return false");
    expect(REFRESH_BUTTON_COPY).toBe("다른 추천 보기");
  });

  it("does not clear sessionStorage or change the context key on click", () => {
    const obj = dateCourseObj();
    const contextKey = courseRepeatContextKey("데이트 코스", obj.scenario);
    const r1 = generateDateCourses(equalScorePool, applyCourseRefreshClick(contextKey).courseRepeatAvoid, 0);
    recordDisplayedCoursePlans(contextKey, r1.slice(0, 3));
    const before = window.sessionStorage.getItem("hama_course_repeat_v1");
    const click = applyCourseRefreshClick(contextKey);
    expect(window.sessionStorage.getItem("hama_course_repeat_v1")).toBe(before);
    expect(click.courseRepeatAvoid.placeIds.length).toBeGreaterThan(0);
    expect(courseRepeatContextKey("데이트 코스", obj.scenario)).toBe(contextKey);
    expect(courseRepeatContextKey("가족 코스", "family")).not.toBe(contextKey);
  });
});
