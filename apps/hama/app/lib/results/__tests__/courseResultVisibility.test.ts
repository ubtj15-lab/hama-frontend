import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { resolveOrdinaryRecommendationListVisible } from "../courseResultVisibility";

describe("course result visibility (Results layer only)", () => {
  it("A: 데이트 코스 + valid course plans hides ordinary DATE list and keeps course deck", () => {
    const parsed = parseScenarioIntent("데이트 코스");
    expect(parsed.recommendationMode).toBe("course");
    expect(parsed.intentType).toBe("course_generation");

    const showCourseDeck = true;
    const showRecommendationList = resolveOrdinaryRecommendationListVisible({
      showCourseDeck,
      baseShowRecommendationList: false,
      forceSituationRecommendationListVisible: false,
      forceShowListByCards: true,
    });

    expect(showCourseDeck).toBe(true);
    expect(showRecommendationList).toBe(false);
  });

  it("B: normal 데이트 keeps ordinary DATE recommendation list", () => {
    const parsed = parseScenarioIntent("데이트");
    expect(parsed.recommendationMode).not.toBe("course");
    expect(parsed.intentType).toBe("scenario_recommendation");

    const showCourseDeck = false;
    const showRecommendationList = resolveOrdinaryRecommendationListVisible({
      showCourseDeck,
      baseShowRecommendationList: true,
      forceSituationRecommendationListVisible: true,
      forceShowListByCards: true,
    });

    expect(showRecommendationList).toBe(true);
  });

  it("C: course mode with no valid course keeps ordinary recommendation fallback", () => {
    const parsed = parseScenarioIntent("데이트 코스");
    expect(parsed.recommendationMode).toBe("course");

    const showCourseDeck = false;
    const courseFallbackActive = true;
    const showRecommendationList = resolveOrdinaryRecommendationListVisible({
      showCourseDeck,
      baseShowRecommendationList: courseFallbackActive,
      forceSituationRecommendationListVisible: false,
      forceShowListByCards: true,
    });

    expect(showCourseDeck).toBe(false);
    expect(showRecommendationList).toBe(true);
  });
});
