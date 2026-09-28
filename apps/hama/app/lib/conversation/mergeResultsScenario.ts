import { parseScenarioIntent } from "@/lib/scenarioEngine/intentClassification";
import type { FoodSubCategory, ScenarioObject } from "@/lib/scenarioEngine/types";
import type { ConversationContext } from "./types";
import { detectRefinementType } from "./refinement";
import { isSelfContainedCurrentTurn } from "./selfContainedTurn";
import { detectLinkedFoodPurpose } from "./linkedPurpose";
import { namedAreaFromUtterance, withNamedRegion } from "./namedRegion";
import { negatedFoodSub } from "./followUp";
import { diningOutCategory } from "./capability";

/**
 * 결과 페이지 전용: 후보 풀·랭킹 분기(intentType / intentCategory / FOOD 세부)는
 * 항상 현재 URL 쿼리(`parseScenarioIntent`) 기준으로 고정하고,
 * 대화 컨텍스트의 메모리·누적 조건만 얹습니다.
 *
 * 자립 턴은 current parse 가 scenario / withKids / purpose 를 소유합니다.
 * 의존 후속(실내로, 가까운 데)만 이전 structured fields 를 상속합니다.
 */
export function mergeResultsScenario(
  qRaw: string,
  convCtx: ConversationContext | null
): ScenarioObject | null {
  const raw = String(qRaw ?? "").trim();
  if (!raw) return null;
  const base = parseScenarioIntent(raw);
  if (!convCtx) return withNamedRegion(base, raw);

  const m = convCtx.currentIntent;
  const refinement = detectRefinementType(raw, convCtx);
  const region = namedAreaFromUtterance(raw) ?? m.region;
  const addsLinkedFood = detectLinkedFoodPurpose(raw);
  const keepPrimaryList = addsLinkedFood && Boolean(m.intentCategory);
  const keepsEarlierConditions =
    refinement === "refine" ||
    refinement === "narrow" ||
    refinement === "reject" ||
    refinement === "broaden" ||
    refinement === "clarify";
  const keepVertical = keepsEarlierConditions || keepPrimaryList;
  const blockedSub = negatedFoodSub(raw);
  const rejectedSubs = new Set(m.conversationRejectedFoodSubs ?? []);
  const usableSub = (sub: FoodSubCategory | null | undefined) =>
    sub && sub !== blockedSub && !rejectedSubs.has(sub) ? sub : undefined;
  if (!keepsEarlierConditions && isSelfContainedCurrentTurn(raw, m)) {
    return {
      ...base,
      region,
      intentCategory: base.intentCategory ?? diningOutCategory(raw) ?? undefined,
      conversationExcludePlaceIds: m.conversationExcludePlaceIds,
      conversationRejectedFoodSubs: m.conversationRejectedFoodSubs,
      conversationExcludeMenuTerms: m.conversationExcludeMenuTerms,
    };
  }

  return {
    ...m,
    region,
    intentType: keepVertical ? (m.intentType ?? base.intentType) : (base.intentType ?? m.intentType),
    recommendationMode: keepsEarlierConditions
      ? (m.recommendationMode ?? base.recommendationMode)
      : (base.recommendationMode ?? m.recommendationMode),
    intentCategory: addsLinkedFood
      ? m.intentCategory
      : keepVertical
        ? (m.intentCategory ?? base.intentCategory ?? diningOutCategory(raw) ?? undefined)
        : (base.intentCategory ?? m.intentCategory ?? diningOutCategory(raw) ?? undefined),
    intentStrict: keepVertical ? (m.intentStrict ?? base.intentStrict) : (base.intentStrict ?? m.intentStrict),
    mealRequired: keepPrimaryList ? m.mealRequired : (base.mealRequired ?? m.mealRequired),
    foodSubCategory: keepPrimaryList ? usableSub(m.foodSubCategory) : (usableSub(base.foodSubCategory) ?? usableSub(m.foodSubCategory)),
    menuIntent: keepPrimaryList ? m.menuIntent : (base.menuIntent?.length ? base.menuIntent : m.menuIntent),
    indoorPreferred: base.indoorPreferred ?? m.indoorPreferred,
    withKids: base.withKids === true ? true : m.withKids,
    withParents: base.withParents === true ? true : m.withParents,
    queryUnderstanding: m.queryUnderstanding,
    rawQuery: base.rawQuery,
  };
}
