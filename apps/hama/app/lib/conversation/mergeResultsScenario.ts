import { parseScenarioIntent } from "@/lib/scenarioEngine/intentClassification";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import type { ConversationContext } from "./types";
import { detectRefinementType } from "./refinement";
import { isSelfContainedCurrentTurn } from "./selfContainedTurn";
import { detectLinkedFoodPurpose } from "./linkedPurpose";
import { namedAreaFromUtterance, withNamedRegion } from "./namedRegion";

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
  const keepPrimaryList = detectLinkedFoodPurpose(raw) && Boolean(m.intentCategory);
  const keepsEarlierConditions =
    refinement === "refine" ||
    refinement === "narrow" ||
    refinement === "reject" ||
    refinement === "broaden" ||
    refinement === "clarify";
  const keepVertical = keepsEarlierConditions || keepPrimaryList;
  if (!keepsEarlierConditions && isSelfContainedCurrentTurn(raw, m)) {
    return {
      ...base,
      region,
      conversationExcludePlaceIds: m.conversationExcludePlaceIds,
      conversationRejectedFoodSubs: m.conversationRejectedFoodSubs,
      conversationExcludeMenuTerms: m.conversationExcludeMenuTerms,
    };
  }

  return {
    ...m,
    region,
    intentType: keepVertical ? (m.intentType ?? base.intentType) : (base.intentType ?? m.intentType),
    recommendationMode: base.recommendationMode ?? m.recommendationMode,
    intentCategory: keepVertical ? (m.intentCategory ?? base.intentCategory) : (base.intentCategory ?? m.intentCategory),
    intentStrict: keepVertical ? (m.intentStrict ?? base.intentStrict) : (base.intentStrict ?? m.intentStrict),
    mealRequired: keepPrimaryList ? m.mealRequired : (base.mealRequired ?? m.mealRequired),
    foodSubCategory: keepPrimaryList ? m.foodSubCategory : (base.foodSubCategory ?? m.foodSubCategory),
    menuIntent: keepPrimaryList ? m.menuIntent : (base.menuIntent?.length ? base.menuIntent : m.menuIntent),
    indoorPreferred: base.indoorPreferred ?? m.indoorPreferred,
    withKids: base.withKids === true ? true : m.withKids,
    withParents: base.withParents === true ? true : m.withParents,
    queryUnderstanding: m.queryUnderstanding,
    rawQuery: base.rawQuery,
  };
}
