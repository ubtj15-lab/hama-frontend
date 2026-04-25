import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { scenarioTypeToRankKey } from "@/lib/scenarioEngine/scenarioRankBridge";
import type { RecommendScenarioKey } from "@/lib/recommend/scenarioWeights";
import { childFriendlyScore, isHardExcludedForKidsScenario } from "@/lib/recommend/childFriendlyScore";
import { isDrinkOnlyCafeForMealContext } from "@/lib/recommend/mealContextSignals";
import { computeFamilyPlaceProfile } from "@/lib/recommend/placeFamilyClassification";

/** 시나리오 적합도가 낮을 때 거리 가산을 줄여 ‘가깝지만 안 맞는 곳’이 올라오지 않게 */
export function distanceBlendForScenarioFit(scenarioRich: number): number {
  if (scenarioRich < 34) return 0.52;
  if (scenarioRich < 44) return 0.68;
  if (scenarioRich < 54) return 0.84;
  return 1;
}

const DATE_MAIN_CONFLICT =
  /아이\s*동반|키즈존|가족\s*외식|회식\s*형|푸드코트|food\s*court|시끄|북적|빠른\s*회전|회전\s*빠름|단체\s*전문/i;

const SOLO_MAIN_CONFLICT =
  /가족\s*외식|회식\s*전문|단체\s*코스|2인\s*이상|예약\s*필수|코스\s*요리\s*전문|룸\s*코스/i;

/** 메인 1순위에서 제외할 만한 시나리오 충돌(이미 하드 제외된 풀 외 보정) */
export function isDisqualifiedMainPick(input: {
  scenarioObject: ScenarioObject | null | undefined;
  blob: string;
  scenarioRichScore: number;
  card: HomeCard;
}): boolean {
  const so = input.scenarioObject;
  const blob = input.blob;
  const sr = input.scenarioRichScore;
  const card = input.card;
  if (!so || so.scenario === "generic") {
    return sr < 15;
  }

  const sc = so.scenario;
  const rawQ = so.rawQuery ?? "";
  if (sc === "family_kids" || sc === "parent_child_outing") {
    if (isHardExcludedForKidsScenario(card, { rawQuery: rawQ })) return true;
    if (String(card.category ?? "").toLowerCase() === "cafe") return true;
    if (childFriendlyScore(card) < 0.33) return true;
    if (sr < 36) return true;
    return false;
  }
  if (sc === "family") {
    if (isHardExcludedForKidsScenario(card, { rawQuery: rawQ })) return true;
    if (String(card.category ?? "").toLowerCase() === "cafe" && isDrinkOnlyCafeForMealContext(card)) return true;
    if (childFriendlyScore(card) < 0.33) return true;
    if (sr < 36) return true;
    return false;
  }

  if (sc === "date" || sc === "parents") {
    if (DATE_MAIN_CONFLICT.test(blob) && sr < 58) return true;
    if (sr < 34) return true;
    return false;
  }

  if (sc === "solo") {
    if (so.mealRequired === true && isDrinkOnlyCafeForMealContext(card)) return true;
    if (SOLO_MAIN_CONFLICT.test(blob) && sr < 52) return true;
    if (sr < 30) return true;
    return false;
  }

  return sr < 24;
}

/** 보조 추천이 메인과 시나리오 충돌인지(같은 시나리오에서 금지 패턴) */
export function isBackupScenarioConflict(
  scenarioObject: ScenarioObject | null | undefined,
  _mainBlob: string,
  cardBlob: string,
  card: HomeCard
): boolean {
  const so = scenarioObject;
  if (!so) return false;
  const sc = so.scenario;
  if (sc === "family_kids" || sc === "parent_child_outing") {
    const prof = computeFamilyPlaceProfile(card);
    return (
      isHardExcludedForKidsScenario(card, { rawQuery: so.rawQuery }) ||
      childFriendlyScore(card) < 0.26 ||
      prof.servingType === "drink_only" ||
      (String(card.category ?? "").toLowerCase() === "cafe" && prof.servingType !== "light_meal")
    );
  }
  if (sc === "family") {
    return (
      isHardExcludedForKidsScenario(card, { rawQuery: so.rawQuery }) ||
      childFriendlyScore(card) < 0.26 ||
      (String(card.category ?? "").toLowerCase() === "cafe" && isDrinkOnlyCafeForMealContext(card))
    );
  }
  if (sc === "date" || sc === "parents") {
    return DATE_MAIN_CONFLICT.test(cardBlob) && !/프라이빗|조용|감성/.test(cardBlob);
  }
  if (sc === "solo" && so.mealRequired === true) {
    return isDrinkOnlyCafeForMealContext(card);
  }
  return false;
}

export function rankKeyFromCtx(scenarioObject: ScenarioObject | null | undefined): RecommendScenarioKey | null {
  if (!scenarioObject || scenarioObject.scenario === "generic") return null;
  return scenarioTypeToRankKey(scenarioObject.scenario);
}
