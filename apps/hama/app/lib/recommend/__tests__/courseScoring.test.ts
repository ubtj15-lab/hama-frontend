import { describe, expect, it } from "vitest";
import { scenarioFlowFit, scoreStep } from "../courseScoring";
import type { ScenarioContext } from "../courseTypes";
import {
  ctxDateEvening,
  ctxFamilyKidsToddlerRainy,
  ctxSoloLunch,
  placeDonkatsu,
  placeMegaCoffee,
  placeSushiBar,
  placeVibeRestaurant,
  placeWalkPark,
} from "./fixtures";

describe("courseScoring", () => {
  it("date evening 에서 분위기 식당 점수가 높게 나온다", () => {
    const { score } = scoreStep(placeVibeRestaurant, "FOOD", ctxDateEvening, null);
    expect(score).toBeGreaterThan(55);
  });

  it("family_kids 에서 돈까스집이 횟집보다 FOOD 단계 점수가 높다", () => {
    const ctx: ScenarioContext = {
      scenario: "family_kids",
      timeOfDay: "lunch",
      weather: "clear",
      childAgeGroup: "toddler",
    };
    const d = scoreStep(placeDonkatsu, "FOOD", ctx, null).score;
    const s = scoreStep(placeSushiBar, "FOOD", ctx, null).score;
    expect(d).toBeGreaterThan(s);
  });

  it("solo 식사 요청에서 drink-only 카페형 restaurant 가 FOOD 에 불리하다", () => {
    const a = scoreStep(placeMegaCoffee, "FOOD", ctxSoloLunch, null).score;
    const b = scoreStep(
      {
        id: "meal",
        name: "한식 점심",
        category: "restaurant",
        tags: ["한식", "점심"],
      },
      "FOOD",
      ctxSoloLunch,
      null
    ).score;
    expect(b).toBeGreaterThan(a);
  });

  it("rainy + WALK 포함 시 scenarioFlowFit 이 맑은 날보다 낮다", () => {
    const rainy: ScenarioContext = {
      scenario: "family_kids",
      timeOfDay: "afternoon",
      weather: "rainy",
      childAgeGroup: "toddler",
    };
    const clearCtx: ScenarioContext = { ...rainy, weather: "clear" };
    const steps = ["FOOD", "WALK", "CAFE"] as const;
    const fr = scenarioFlowFit(rainy, [...steps]);
    const fc = scenarioFlowFit(clearCtx, [...steps]);
    expect(fr).toBeLessThan(fc);
  });

});
