import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { generateCourses } from "@/lib/scenarioEngine/courseEngine";
import { resolveScenarioConfig } from "@/lib/scenarioEngine/resolveScenarioConfig";
import type { HomeCard } from "@/lib/storeTypes";
import {
  compareEqualScoreUnseenFirst,
  courseRepeatContextKey,
  courseRepeatsDisplayed,
  orderedCourseSignature,
  recordDisplayedCoursePlans,
  unorderedCourseSignature,
  type CourseRepeatAvoidance,
} from "../courseRepeat";

function card(id: string, category: string, name?: string): HomeCard {
  return { id, name: name ?? id, category, tags: [], mood: [] };
}

function dateCourseObj() {
  return parseScenarioIntent("데이트 코스");
}

describe("Course Repeat V1 helpers", () => {
  it("keys course contexts separately", () => {
    expect(courseRepeatContextKey("데이트 코스", "date")).not.toBe(
      courseRepeatContextKey("가족 코스", "family")
    );
    expect(courseRepeatContextKey("데이트 코스", "date")).not.toBe(
      courseRepeatContextKey("아이랑 코스", "family_kids")
    );
    expect(courseRepeatContextKey("데이트 코스", "date")).toBe(
      courseRepeatContextKey("  데이트   코스  ", "date")
    );
  });

  it("treats reordered trios as the same unordered signature", () => {
    const a = ["p1", "p2", "p3"];
    const b = ["p3", "p2", "p1"];
    expect(orderedCourseSignature(a)).not.toBe(orderedCourseSignature(b));
    expect(unorderedCourseSignature(a)).toBe(unorderedCourseSignature(b));
    const avoid: CourseRepeatAvoidance = {
      placeIds: a,
      orderedSignatures: [orderedCourseSignature(a)],
      unorderedSignatures: [unorderedCourseSignature(a)],
    };
    expect(courseRepeatsDisplayed(b, avoid)).toBe(true);
  });

  it("prefers unseen only on equal scores", () => {
    const seen = new Set(["seen"]);
    expect(compareEqualScoreUnseenFirst(65, "unseen", 65, "seen", seen)).toBeLessThan(0);
    expect(compareEqualScoreUnseenFirst(63, "seen", 61, "unseen", seen)).toBeLessThan(0);
    expect(compareEqualScoreUnseenFirst(65, "a", 65, "b", new Set())).toBe(0);
  });
});

describe("Course Repeat V1 generateCourses", () => {
  const pool: HomeCard[] = [
    card("food-seen", "restaurant", "돌고래마차"),
    card("food-alt", "restaurant", "와다이"),
    card("act-seen", "activity", "아케이드엑스 오산동탄점"),
    card("act-alt", "activity", "바운스테마파크 오산점"),
    card("cafe-lead", "cafe", "송강커피"),
    card("cafe-alt", "cafe", "그래이스그래니"),
  ];

  it("ROUND1 with empty avoid stays deterministic", () => {
    const obj = dateCourseObj();
    const cfg = resolveScenarioConfig(obj);
    const a = generateCourses(pool, obj, cfg, 3, { homeTab: "all" });
    const b = generateCourses(pool, obj, cfg, 3, { homeTab: "all" });
    expect(a[0]?.stops.map((s) => s.placeId)).toEqual(b[0]?.stops.map((s) => s.placeId));
    expect(a.length).toBeGreaterThan(0);
  });

  it("R2+ avoids exact ordered and reordered trio when an alternative exists", () => {
    const obj = dateCourseObj();
    const cfg = resolveScenarioConfig(obj);
    const r1 = generateCourses(pool, obj, cfg, 3, { homeTab: "all" });
    const first = r1[0];
    expect(first).toBeTruthy();
    const ids = first!.stops.map((s) => s.placeId);
    const avoid: CourseRepeatAvoidance = {
      placeIds: ids,
      orderedSignatures: [orderedCourseSignature(ids)],
      unorderedSignatures: [unorderedCourseSignature(ids)],
    };
    const r2 = generateCourses(pool, obj, cfg, 3, { homeTab: "all", courseRepeat: avoid });
    const r2ids = r2[0]?.stops.map((s) => s.placeId) ?? [];
    expect(r2ids.length).toBeGreaterThan(0);
    expect(orderedCourseSignature(r2ids)).not.toBe(orderedCourseSignature(ids));
    expect(unorderedCourseSignature(r2ids)).not.toBe(unorderedCourseSignature(ids));
  });

  it("falls back to a prior safe course when supply is exhausted", () => {
    const obj = dateCourseObj();
    const cfg = resolveScenarioConfig(obj);
    const tiny = [card("only-food", "restaurant"), card("only-cafe", "cafe"), card("only-act", "activity")];
    const r1 = generateCourses(tiny, obj, cfg, 1, { homeTab: "all" });
    const ids = r1[0]?.stops.map((s) => s.placeId) ?? [];
    expect(ids.length).toBeGreaterThan(0);
    const avoid: CourseRepeatAvoidance = {
      placeIds: ids,
      orderedSignatures: [orderedCourseSignature(ids)],
      unorderedSignatures: [unorderedCourseSignature(ids)],
    };
    const r2 = generateCourses(tiny, obj, cfg, 1, { homeTab: "all", courseRepeat: avoid });
    expect(r2.length).toBeGreaterThan(0);
    expect(r2[0]?.stops.length).toBeGreaterThan(0);
  });

  it("does not persist DATE ranking cards as course exposure", () => {
    const recorded = recordDisplayedCoursePlans("course|date|데이트 코스", [
      { stops: [{ placeId: "course-a" }, { placeId: "course-b" }] },
    ]);
    expect(recorded.placeIds).toEqual(["course-a", "course-b"]);
    expect(recorded.placeIds).not.toContain("daily-oasis");
  });
});
