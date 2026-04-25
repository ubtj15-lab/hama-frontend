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
    mealRequired: true,
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

  const starbucks = card({
    id: "starbucks",
    name: "스타벅스",
    category: "cafe",
    tags: ["커피"],
  });
  const mega = card({
    id: "mega",
    name: "메가커피",
    category: "cafe",
    tags: ["커피", "테이크아웃"],
  });
  const familyKidsBare: ScenarioObject = {
    intentType: "scenario_recommendation",
    scenario: "family_kids",
    rawQuery: "아이랑",
    mealRequired: true,
  };
  const chainDeck = buildTopRecommendations([starbucks, mega, familyOk], {
    intent: "family",
    userLat: 37.26,
    userLng: 127.02,
    searchQuery: "아이랑",
    scenarioObject: familyKidsBare,
  });
  assert.ok(
    !chainDeck.some((s) => s.card.id === "starbucks" || s.card.id === "mega"),
    "아이랑만 있어도 스타벅스·메가커피 등 drink-only 카페는 제외"
  );
  assert.ok(chainDeck.some((s) => s.card.id === "fam-ok"), "가족·아이 적합 식당은 남음");

  const closedOk = {
    ...familyOk,
    id: "fam-ok-closed",
    business_state: "CLOSED",
  } as HomeCard;
  const relaxedFamilyDeck = buildTopRecommendations([mega, closedOk], {
    intent: "family",
    userLat: 37.26,
    userLng: 127.02,
    searchQuery: "아이랑",
    scenarioObject: familyKidsBare,
  });
  assert.ok(
    !relaxedFamilyDeck.some((s) => s.card.id === "mega"),
    "폴백(relaxed)에서도 drink-only 카페는 제외"
  );
  assert.ok(
    relaxedFamilyDeck.some((s) => s.card.id === "fam-ok-closed"),
    "폴백에서는 영업 종료만 완화·카페 필터는 유지"
  );

  const compose = card({
    id: "compose",
    name: "컴포즈커피",
    category: "cafe",
    tags: ["커피"],
  });
  const bb = card({
    id: "bb",
    name: "빽다방",
    category: "cafe",
    tags: ["커피"],
  });
  const moreChains = buildTopRecommendations([compose, bb, familyOk], {
    intent: "family",
    userLat: 37.26,
    userLng: 127.02,
    searchQuery: "아이랑",
    scenarioObject: familyKidsBare,
  });
  assert.ok(
    !moreChains.some((s) => s.card.id === "compose" || s.card.id === "bb"),
    "컴포즈·빽다방 등 체인 음료 카페도 제외"
  );

  const brunchDeck = buildTopRecommendations([starbucks, mega, familyOk, lightBrunch], {
    intent: "family",
    userLat: 37.26,
    userLng: 127.02,
    searchQuery: "아이랑",
    scenarioObject: familyKidsBare,
  });
  assert.ok(brunchDeck.some((s) => s.card.id === "light-brunch"), "브런치·식사 신호 카페는 허용");
  assert.ok(!brunchDeck.some((s) => s.card.id === "starbucks" || s.card.id === "mega"));
  assert.equal(
    brunchDeck[0]?.card.id,
    "fam-ok",
    "family_kids 메인 1순위는 카페가 아닌 식당"
  );

  const parentKids: ScenarioObject = {
    intentType: "scenario_recommendation",
    scenario: "family_kids",
    rawQuery: "아이랑 부모님 맛집",
    mealRequired: true,
  };
  const parentDeck = buildTopRecommendations([sushi, familyOk], {
    intent: "family",
    userLat: 37.26,
    userLng: 127.02,
    searchQuery: "아이랑 부모님 맛집",
    scenarioObject: parentKids,
  });
  assert.ok(parentDeck.some((s) => s.card.id === "sushi"), "부모님·가족모임 맥락에서는 횟집류를 풀에 둘 수 있음");

  const genericItalian = card({
    id: "italian",
    name: "○○트라토리아",
    category: "restaurant",
    tags: ["파스타", "양식"],
  });
  const don = card({
    id: "don",
    name: "금돈까스",
    category: "restaurant",
    tags: ["돈까스", "가족", "키즈"],
    with_kids: true,
  });
  const mealDeck = buildTopRecommendations([genericItalian, don, mega], {
    intent: "family",
    userLat: 37.26,
    userLng: 127.02,
    searchQuery: "아이랑",
    scenarioObject: familyKidsBare,
  });
  const donIdx = mealDeck.findIndex((s) => s.card.id === "don");
  const itIdx = mealDeck.findIndex((s) => s.card.id === "italian");
  assert.ok(
    donIdx !== -1 && itIdx !== -1 && donIdx < itIdx,
    "아이 동반 식사 추천에서 돈까스·가족형이 일반 양식보다 우선"
  );

  const codOnly = card({
    id: "cod-only",
    name: "○○코다리",
    category: "restaurant",
    tags: ["코다리조림", "한식"],
  });
  const codDeck = buildTopRecommendations([codOnly, familyOk], {
    intent: "family",
    userLat: 37.26,
    userLng: 127.02,
    searchQuery: "아이랑",
    scenarioObject: familyKidsBare,
  });
  assert.ok(!codDeck.some((s) => s.card.id === "cod-only"), "코다리·생선조림류는 기본 아이 추천에서 제외");

  const codSoft = card({
    id: "cod-soft",
    name: "○○한식",
    category: "restaurant",
    tags: ["생선조림", "아이메뉴", "맵지않은"],
  });
  const codSoftDeck = buildTopRecommendations([codSoft, familyOk], {
    intent: "family",
    userLat: 37.26,
    userLng: 127.02,
    searchQuery: "아이랑",
    scenarioObject: familyKidsBare,
  });
  assert.ok(
    codSoftDeck.some((s) => s.card.id === "cod-soft"),
    "아이메뉴·순한맛 등 완화 태그가 있으면 생선조림 매장은 풀에 남고 감점만"
  );

  const codQueryScenario: ScenarioObject = {
    ...familyKidsBare,
    rawQuery: "아이랑 코다리",
  };
  const codQueryDeck = buildTopRecommendations([codOnly, familyOk], {
    intent: "family",
    userLat: 37.26,
    userLng: 127.02,
    searchQuery: "아이랑 코다리",
    scenarioObject: codQueryScenario,
  });
  assert.ok(
    codQueryDeck.some((s) => s.card.id === "cod-only"),
    "쿼리에 코다리·생선요리 맥락이 있으면 조건부 허용"
  );

  // eslint-disable-next-line no-console
  console.log("buildTopRecommendations ranking tests: ok");
}

main();
