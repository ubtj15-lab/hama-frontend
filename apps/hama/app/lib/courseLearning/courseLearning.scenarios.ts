import type { PlaceType, ScenarioObject } from "@/lib/scenarioEngine/types";
import { computeLearnedBoosts } from "./courseLearningBoost";
import { CourseLearningStore } from "./courseLearningStore";
import { MIN_IMPRESSIONS_FULL_WEIGHT } from "./courseLearningConstants";

function payload(
  templateId: string,
  steps: PlaceType[],
  extra: Partial<ScenarioObject> = {}
) {
  return {
    courseId: `c-${templateId}`,
    templateId,
    scenario: "family" as const,
    childAgeGroup: "toddler" as const,
    weatherCondition: "rainy" as const,
    timeOfDay: "afternoon" as const,
    stepCategories: steps,
    placeIds: ["p1", "p2"],
    sourcePage: "home",
    rank: 0,
    ...extra,
  };
}

/**
 * 코스 학습·부스트 검증. 실패 시 설명 문자열 배열 반환.
 */
export function runCourseLearningChecks(): string[] {
  const failures: string[] = [];
  const tplId = "family-food-activity";
  const steps: PlaceType[] = ["FOOD", "ACTIVITY"];
  const store = new CourseLearningStore();

  for (let i = 0; i < MIN_IMPRESSIONS_FULL_WEIGHT + 8; i++) {
    store.recordEvent("course_impression", payload(tplId, steps));
  }
  for (let i = 0; i < 14; i++) {
    store.recordEvent("course_start_click", payload(tplId, steps));
  }
  for (let i = 0; i < 6; i++) {
    store.recordEvent("course_save", payload(tplId, steps));
  }

  const obj: ScenarioObject = {
    intentType: "course_generation",
    scenario: "family",
    rawQuery: "가족",
    childAgeGroup: "toddler",
    weatherCondition: "rainy",
    timeOfDay: "afternoon",
    confidence: 0.9,
  };

  const boost = computeLearnedBoosts(store, {
    obj,
    templateId: tplId,
    steps,
    placeIds: ["p1", "p2"],
    totalTravelMin: 25,
    def: {
      id: tplId,
      steps,
      indoorPreference: "mixed",
      movementLevel: "medium",
      vibeTags: ["가족"],
    },
    cards: [
      { id: "p1", name: "식당", category: "restaurant" },
      { id: "p2", name: "놀이", category: "activity" },
    ],
  });

  if (boost.total <= 0) {
    failures.push("learning: expected positive total boost after many strong events");
  }
  if (boost.scenarioPatternBoost <= 0) {
    failures.push("learning: scenario aggregate (* template) should contribute");
  }

  const sparse = new CourseLearningStore();
  sparse.recordEvent("course_impression", {
    ...payload("date-eve-food-cafe", ["FOOD", "CAFE"], {
      scenario: "date",
      childAgeGroup: undefined,
      weatherCondition: "clear",
      dateTimeBand: "evening",
      timeOfDay: "dinner",
    }),
  });
  sparse.recordEvent("course_start_click", {
    ...payload("date-eve-food-cafe", ["FOOD", "CAFE"], {
      scenario: "date",
      weatherCondition: "clear",
      dateTimeBand: "evening",
      timeOfDay: "dinner",
    }),
  });

  const sparseBoost = computeLearnedBoosts(sparse, {
    obj: {
      ...obj,
      scenario: "date",
      dateTimeBand: "evening",
      weatherCondition: "clear",
      timeOfDay: "dinner",
      childAgeGroup: undefined,
    },
    templateId: "date-eve-food-cafe",
    steps: ["FOOD", "CAFE"],
    placeIds: ["a", "b"],
    totalTravelMin: 18,
    def: {
      id: "date-eve-food-cafe",
      steps: ["FOOD", "CAFE"],
      indoorPreference: "indoor",
      movementLevel: "low",
      vibeTags: [],
    },
    cards: [
      { id: "a", name: "R", category: "restaurant" },
      { id: "b", name: "C", category: "cafe" },
    ],
  });

  if (sparseBoost.total > 6) {
    failures.push("learning: sparse data should keep boost modest (stability)");
  }

  return failures;
}
