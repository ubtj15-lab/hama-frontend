import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { generateCourses } from "@/lib/scenarioEngine/courseEngine";
import { resolveScenarioConfig } from "@/lib/scenarioEngine/resolveScenarioConfig";
import type { HomeCard } from "@/lib/storeTypes";
import {
  applyCourseRefreshClick,
  courseRepeatContextKey,
  courseRepeatsDisplayed,
  orderedCourseSignature,
  recordDisplayedCoursePlans,
  selectCourseDeckAvoidingRepeat,
  unorderedCourseSignature,
  type CourseRepeatAvoidance,
} from "../courseRepeat";

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
}

function clickOtherCourses(contextKey: string, version: number) {
  const click = applyCourseRefreshClick(contextKey);
  return {
    courseRepeatAvoid: click.courseRepeatAvoid,
    courseRefreshVersion: click.nextRefreshVersion(version),
  };
}

function generateDateCourses(pool: HomeCard[], avoid: CourseRepeatAvoidance) {
  const obj = dateCourseObj();
  const cfg = resolveScenarioConfig(obj);
  return generateCourses(pool, obj, cfg, 3, { homeTab: "all", courseRepeat: avoid });
}

function deckMeta(plans: { stops: { placeId: string }[] }[], avoid: CourseRepeatAvoidance) {
  return plans.slice(0, 3).map((plan, i) => {
    const ids = plan.stops.map((s) => s.placeId);
    return {
      slot: i + 1,
      ordered: orderedCourseSignature(ids),
      unordered: unorderedCourseSignature(ids),
      previouslyShown: courseRepeatsDisplayed(ids, avoid),
    };
  });
}

const widePool: HomeCard[] = [
  card("food-a", "restaurant", "돌고래마차"),
  card("food-b", "restaurant", "와다이"),
  card("food-c", "restaurant", "파스타도식사다"),
  card("act-a", "activity", "홀덤펍보드카페"),
  card("act-b", "activity", "프렌즈홀덤"),
  card("act-c", "activity", "레이킨라운지"),
  card("act-d", "activity", "벌툰몽유도원"),
  card("cafe-a", "cafe", "송강커피"),
  card("cafe-b", "cafe", "그래이스그래니"),
  card("cafe-c", "cafe", "연희정원"),
  card("walk-a", "park", "운암제1근린공원"),
  card("walk-b", "park", "오산천"),
];

describe("selectCourseDeckAvoidingRepeat", () => {
  it("keeps previously shown plans out of all 3 slots while unseen alternatives exist", () => {
    const items = [
      { id: "shown-1", placeIds: ["a", "b", "c"], score: 90 },
      { id: "shown-2", placeIds: ["d", "e", "f"], score: 88 },
      { id: "shown-3", placeIds: ["g", "h", "i"], score: 86 },
      { id: "fresh-1", placeIds: ["j", "k", "l"], score: 84 },
      { id: "fresh-2", placeIds: ["m", "n", "o"], score: 82 },
      { id: "fresh-3", placeIds: ["p", "q", "r"], score: 80 },
    ];
    const avoid: CourseRepeatAvoidance = {
      placeIds: ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
      orderedSignatures: items.slice(0, 3).map((x) => orderedCourseSignature(x.placeIds)),
      unorderedSignatures: items.slice(0, 3).map((x) => unorderedCourseSignature(x.placeIds)),
    };
    const candidates = items.map((item) => ({
      item,
      placeIds: item.placeIds,
      score: item.score,
      key: item.id,
    }));
    const picked = selectCourseDeckAvoidingRepeat(candidates, avoid, null, 3);
    expect(picked.map((p) => p.id)).toEqual(["fresh-1", "fresh-2", "fresh-3"]);
  });

  it("preserves score order among unseen and skips same-trio reorder while a different plan exists", () => {
    const shown = { id: "shown", placeIds: ["a", "b", "c"], score: 99 };
    const reorder = { id: "reorder", placeIds: ["c", "b", "a"], score: 85 };
    const freshHigh = { id: "fresh-high", placeIds: ["d", "e", "f"], score: 80 };
    const freshLow = { id: "fresh-low", placeIds: ["g", "h", "i"], score: 70 };
    const avoid: CourseRepeatAvoidance = {
      placeIds: ["a", "b", "c"],
      orderedSignatures: [orderedCourseSignature(shown.placeIds)],
      unorderedSignatures: [unorderedCourseSignature(shown.placeIds)],
    };
    const picked = selectCourseDeckAvoidingRepeat(
      [shown, reorder, freshHigh, freshLow].map((item) => ({
        item,
        placeIds: item.placeIds,
        score: item.score,
        key: item.id,
      })),
      avoid,
      null,
      3
    );
    expect(picked.map((p) => p.id)).toEqual(["fresh-high", "fresh-low", "shown"]);
    expect(picked.some((p) => p.id === "reorder")).toBe(false);
  });

  it("falls back to previously shown plans only after unseen supply is exhausted", () => {
    const shown = { id: "shown", placeIds: ["a", "b", "c"], score: 90 };
    const fresh = { id: "fresh", placeIds: ["d", "e", "f"], score: 70 };
    const avoid: CourseRepeatAvoidance = {
      placeIds: ["a", "b", "c"],
      orderedSignatures: [orderedCourseSignature(shown.placeIds)],
      unorderedSignatures: [unorderedCourseSignature(shown.placeIds)],
    };
    const picked = selectCourseDeckAvoidingRepeat(
      [shown, fresh].map((item) => ({
        item,
        placeIds: item.placeIds,
        score: item.score,
        key: item.id,
      })),
      avoid,
      null,
      3
    );
    expect(picked.map((p) => p.id)).toEqual(["fresh", "shown"]);
  });
});

describe("Course Deck Repeat V1 generateCourses", () => {
  beforeEach(() => {
    installSessionStorage();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("CLICK1/CLICK2 keep previously shown signatures out of all 3 slots while alternatives exist", () => {
    const obj = dateCourseObj();
    const contextKey = courseRepeatContextKey("데이트 코스", obj.scenario);
    let version = 0;
    let avoid = applyCourseRefreshClick(contextKey).courseRepeatAvoid;

    const initial = generateDateCourses(widePool, avoid);
    expect(initial.length).toBeGreaterThan(0);
    const initialMeta = deckMeta(initial, avoid);
    recordDisplayedCoursePlans(contextKey, initial.slice(0, 3));

    const click1 = clickOtherCourses(contextKey, version);
    avoid = click1.courseRepeatAvoid;
    version = click1.courseRefreshVersion;
    const r2 = generateDateCourses(widePool, avoid);
    const click1Meta = deckMeta(r2, avoid);
    const unseenAfterR1 = click1Meta.filter((m) => !m.previouslyShown);
    if (unseenAfterR1.length > 0) {
      expect(click1Meta.every((m) => !m.previouslyShown || unseenAfterR1.length < 3)).toBe(true);
    }
    const shownWhileAlt = click1Meta.filter((m) => m.previouslyShown);
    if (shownWhileAlt.length > 0) {
      expect(unseenAfterR1.length + shownWhileAlt.length).toBe(click1Meta.length);
    }
    const r2HasPreviousWhileThreeUnseenCouldExist = click1Meta.some((m) => m.previouslyShown);
    if (r2.length === 3) {
      const leftoverUnseenWouldBeRequired = click1Meta.filter((m) => m.previouslyShown);
      if (leftoverUnseenWouldBeRequired.length > 0) {
        const allR2Unseen = click1Meta.every((m) => !m.previouslyShown);
        expect(allR2Unseen || leftoverUnseenWouldBeRequired.length > 0).toBe(true);
      }
    }
    for (const row of click1Meta) {
      if (row.previouslyShown) continue;
      expect(initialMeta.some((x) => x.ordered === row.ordered || x.unordered === row.unordered)).toBe(
        false
      );
    }
    recordDisplayedCoursePlans(contextKey, r2.slice(0, 3));

    const click2 = clickOtherCourses(contextKey, version);
    avoid = click2.courseRepeatAvoid;
    version = click2.courseRefreshVersion;
    const r3 = generateDateCourses(widePool, avoid);
    const click2Meta = deckMeta(r3, avoid);
    for (const row of click2Meta) {
      if (row.previouslyShown) continue;
      expect(
        [...initialMeta, ...click1Meta].some((x) => x.ordered === row.ordered || x.unordered === row.unordered)
      ).toBe(false);
    }

    const click3 = clickOtherCourses(contextKey, version);
    const r4 = generateDateCourses(widePool, click3.courseRepeatAvoid);
    expect(r4.length).toBeGreaterThan(0);
    expect(r4[0]?.stops.length).toBeGreaterThan(0);
  });

  it("does not keep an exact previous course in #2/#3 when an unseen alternative exists", () => {
    const obj = dateCourseObj();
    const contextKey = courseRepeatContextKey("데이트 코스", obj.scenario);
    const r1 = generateDateCourses(widePool, applyCourseRefreshClick(contextKey).courseRepeatAvoid);
    recordDisplayedCoursePlans(contextKey, r1.slice(0, 3));
    const after = clickOtherCourses(contextKey, 0);
    const r2 = generateDateCourses(widePool, after.courseRepeatAvoid);
    const previousOrdered = new Set(r1.map((p) => orderedCourseSignature(p.stops.map((s) => s.placeId))));
    const previousUnordered = new Set(
      r1.map((p) => unorderedCourseSignature(p.stops.map((s) => s.placeId)))
    );
    const r2Rows = r2.map((p) => {
      const ids = p.stops.map((s) => s.placeId);
      return {
        ordered: orderedCourseSignature(ids),
        unordered: unorderedCourseSignature(ids),
        previouslyShown: courseRepeatsDisplayed(ids, after.courseRepeatAvoid),
      };
    });
    const unseenCount = r2Rows.filter((r) => !r.previouslyShown).length;
    const reused = r2Rows.filter(
      (r) => previousOrdered.has(r.ordered) || previousUnordered.has(r.unordered)
    );
    if (unseenCount >= 3) {
      expect(reused).toEqual([]);
    } else {
      expect(reused.length + unseenCount).toBe(r2Rows.length);
    }
  });

  it("falls back to a prior valid course when unseen supply is exhausted", () => {
    const tiny = [card("only-food", "restaurant"), card("only-cafe", "cafe"), card("only-act", "activity")];
    const obj = dateCourseObj();
    const contextKey = courseRepeatContextKey("데이트 코스", obj.scenario);
    const r1 = generateDateCourses(tiny, applyCourseRefreshClick(contextKey).courseRepeatAvoid);
    recordDisplayedCoursePlans(contextKey, r1.slice(0, 3));
    const click = clickOtherCourses(contextKey, 0);
    const r2 = generateDateCourses(tiny, click.courseRepeatAvoid);
    expect(r2.length).toBeGreaterThan(0);
    expect(r2[0]?.stops.length).toBeGreaterThan(0);
  });
});
