import { describe, expect, it } from "vitest";
import type { CourseLearningInput } from "../courseLearning";
import {
  generateCourseFromTemplate,
  generateCourses,
  pickCandidatesForStep,
} from "../courseGenerator";
import { COURSE_TEMPLATE_CATALOG } from "../courseTemplates";
import {
  ctxDateEvening,
  ctxFamilyKidsToddlerRainy,
  ctxSoloLunch,
  placeSushiBar,
  poolDateDiverse,
  poolDateEvening,
  poolFamilyRainy,
  poolSoloLunch,
} from "./fixtures";

describe("courseGenerator", () => {
  it("date evening 에서 생성 코스는 FOOD 이 CAFE 보다 앞선다 (둘 다 있을 때)", () => {
    const courses = generateCourses(ctxDateEvening, poolDateDiverse(), { maxCourses: 3 });
    expect(courses.length).toBeGreaterThan(0);
    for (const c of courses) {
      const tpl = c.steps.map((s) => s.stepCategory);
      const iFood = tpl.indexOf("FOOD");
      const iCafe = tpl.indexOf("CAFE");
      if (iFood >= 0 && iCafe >= 0) {
        expect(iFood).toBeLessThan(iCafe);
      }
    }
  });

  it("family_kids toddler rainy 에서 FOOD → ACTIVITY 흐름을 가진 코스가 하나 이상", () => {
    const courses = generateCourses(ctxFamilyKidsToddlerRainy, poolFamilyRainy(), { maxCourses: 3 });
    const hasFoodThenActivity = courses.some((c) => {
      const t = c.steps.map((s) => s.stepCategory);
      const fi = t.indexOf("FOOD");
      const ai = t.indexOf("ACTIVITY");
      return fi >= 0 && ai > fi;
    });
    expect(hasFoodThenActivity).toBe(true);
  });

  it("family_kids 풀에서 횟집이 FOOD 1순위로 오지 않는다 (돈까스가 우선)", () => {
    const ranked = pickCandidatesForStep("FOOD", poolFamilyRainy(), ctxFamilyKidsToddlerRainy, null, 8);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]!.id).not.toBe(placeSushiBar.id);
  });

  it("solo lunch 코스는 과도하게 길지 않다", () => {
    const courses = generateCourses(ctxSoloLunch, poolSoloLunch(), { maxCourses: 2 });
    expect(courses.length).toBeGreaterThan(0);
    expect(courses[0]!.totalDurationMin).toBeLessThan(320);
  });

  it("learned boost 가 패턴 통계가 있을 때 breakdown 에 반영된다", () => {
    const learning: CourseLearningInput = {
      getPattern: () => ({ impressions: 50, behaviorScore: 200 }),
      getPlace: () => undefined,
    };
    const boosted = generateCourses(ctxDateEvening, poolDateEvening(), { maxCourses: 1, learning });
    const plain = generateCourses(ctxDateEvening, poolDateEvening(), { maxCourses: 1 });
    expect(boosted[0]).toBeDefined();
    expect(plain[0]).toBeDefined();
    expect(boosted[0]!.breakdown.learnedBoost).toBeGreaterThan(plain[0]!.breakdown.learnedBoost);
  });

  it("최대 3개 코스에서 동일 stepPattern 만 반복되지 않도록 템플릿이 갈린다", () => {
    const courses = generateCourses(ctxDateEvening, poolDateDiverse(), { maxCourses: 3 });
    const patterns = new Set(courses.map((c) => c.steps.map((s) => s.stepCategory).join(">")));
    expect(patterns.size).toBeGreaterThanOrEqual(2);
    const tplIds = new Set(courses.map((c) => c.templateId));
    expect(tplIds.size).toBeGreaterThanOrEqual(2);
  });

  it("generateCourseFromTemplate: 단일 템플릿으로 완결된 GeneratedCourse 생성", () => {
    const tpl = COURSE_TEMPLATE_CATALOG.find((t) => t.id === "date-food-cafe")!;
    const g = generateCourseFromTemplate(tpl, poolDateEvening(), ctxDateEvening);
    expect(g).not.toBeNull();
    expect(g!.title.length).toBeGreaterThan(0);
    expect(g!.steps.length).toBe(2);
    expect(g!.humanReadableDuration).toMatch(/총 약/);
    expect(g!.score).toBeGreaterThan(0);
    expect(g!.breakdown.stepsAggregate).toBeGreaterThan(0);
    expect(g!.route.legs.length).toBeGreaterThanOrEqual(1);
  });
});
