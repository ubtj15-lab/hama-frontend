/**
 * 랭킹 strict 규칙 검증 — `npm run test:ranking` (apps/hama)
 */
import assert from "node:assert/strict";
import { buildTopRecommendations } from "./scoring";
import type { HomeCard } from "../storeTypes";
import type { ScenarioObject } from "../scenarioEngine/types";

function card(p: Partial<HomeCard>): HomeCard {
  return {
    id: "c1",
    name: "테스트",
    category: "restaurant",
    lat: 37.26,
    lng: 127.02,
    ...p,
  } as HomeCard;
}

function main() {
  const drinkOnly = card({
    id: "drink-only",
    name: "메가커피",
    category: "cafe",
    servingType: "drink",
    tags: ["커피", "테이크아웃"],
  });
  const lightBrunch = card({
    id: "light-brunch",
    name: "브런치 카페",
    category: "cafe",
    servingType: "light",
    tags: ["브런치", "식사"],
  });

  const soloMealScenario: ScenarioObject = {
    intentType: "scenario_recommendation",
    scenario: "solo",
    rawQuery: "혼밥 점심",
  };

  const soloDeck = buildTopRecommendations([drinkOnly, lightBrunch], {
    intent: "solo",
    userLat: 37.26,
    userLng: 127.02,
    searchQuery: "혼밥 점심",
    scenarioObject: soloMealScenario,
  });
  assert.ok(
    !soloDeck.some((s) => s.card.id === "drink-only"),
    "식사 맥락의 solo 에서 drink-only 카페는 strict 에서 제외되어야 함"
  );
  assert.ok(soloDeck.some((s) => s.card.id === "light-brunch"));

  const sushi = card({
    id: "sushi",
    name: "○○횟집",
    category: "restaurant",
    tags: ["사시미", "오마카세"],
  });
  const familyOk = card({
    id: "fam-ok",
    name: "○○돈까스",
    category: "restaurant",
    tags: ["가족", "돈까스", "키즈"],
    with_kids: true,
  });
  const familyKids: ScenarioObject = {
    intentType: "scenario_recommendation",
    scenario: "family_kids",
    rawQuery: "아이랑",
  };
  const famDeck = buildTopRecommendations([sushi, familyOk], {
    intent: "family",
    userLat: 37.26,
    userLng: 127.02,
    searchQuery: "아이랑 맛집",
    scenarioObject: familyKids,
  });
  assert.ok(
    !famDeck.some((s) => s.card.id === "sushi"),
    "family_kids 시나리오에서 횟집류는 하드 제외"
  );
  assert.ok(famDeck.some((s) => s.card.id === "fam-ok"));

  // eslint-disable-next-line no-console
  console.log("buildTopRecommendations ranking tests: ok");
}

main();
