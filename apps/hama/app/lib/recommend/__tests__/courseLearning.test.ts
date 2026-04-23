import { describe, expect, it } from "vitest";
import {
  MIN_IMPRESSIONS_FOR_LEARNED,
  buildPatternKey,
  learnedImpressionWeight,
  patternLearnedBoost,
  placeLearnedBoost,
  stepPatternFromSteps,
} from "../courseLearning";

describe("courseLearning", () => {
  it("buildPatternKey 가 시나리오·날씨·템플릿·패턴을 포함한다", () => {
    const key = buildPatternKey({
      scenario: "date",
      childAgeGroup: "toddler",
      weather: "rainy",
      timeOfDay: "dinner",
      templateId: "date-food-cafe",
      stepPattern: stepPatternFromSteps(["FOOD", "CAFE"]),
    });
    expect(key).toContain("date");
    expect(key).toContain("toddler");
    expect(key).toContain("rainy");
    expect(key).toContain("date-food-cafe");
    expect(key).toContain("FOOD>CAFE");
  });

  it("impressions 20 미만이면 patternLearnedBoost 는 0", () => {
    expect(patternLearnedBoost(undefined)).toBe(0);
    expect(patternLearnedBoost({ impressions: 0, behaviorScore: 0 })).toBe(0);
    expect(patternLearnedBoost({ impressions: MIN_IMPRESSIONS_FOR_LEARNED - 1, behaviorScore: 100 })).toBe(0);
  });

  it("impressions 충분하면 patternLearnedBoost 가 양수일 수 있다", () => {
    const b = patternLearnedBoost({ impressions: 40, behaviorScore: 120 });
    expect(b).toBeGreaterThan(0);
  });

  it("placeLearnedBoost 는 유효한 장소만 평균 낸다", () => {
    const avg = placeLearnedBoost([
      { impressions: 30, behaviorScore: 80 },
      undefined,
      { impressions: 5, behaviorScore: 99 },
    ]);
    expect(avg).toBeGreaterThan(0);
    expect(avg).toBeLessThanOrEqual(8);
  });

  it("learnedImpressionWeight: 20 미만은 거의 0에 가깝다", () => {
    expect(learnedImpressionWeight(0)).toBe(0);
    expect(learnedImpressionWeight(10)).toBeLessThan(0.1);
  });
});
