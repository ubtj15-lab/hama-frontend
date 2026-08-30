import { parseScenarioIntent } from "@/lib/scenarioEngine/intentClassification";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import type { ConversationContext } from "./types";
import { isSelfContainedCurrentTurn } from "./selfContainedTurn";

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
  if (!convCtx) return base;

  const m = convCtx.currentIntent;
  if (isSelfContainedCurrentTurn(raw, m)) {
    return {
      ...base,
      conversationExcludePlaceIds: m.conversationExcludePlaceIds,
      conversationRejectedFoodSubs: m.conversationRejectedFoodSubs,
      conversationExcludeMenuTerms: m.conversationExcludeMenuTerms,
    };
  }

  return {
    ...m,
    intentType: base.intentType ?? m.intentType,
    recommendationMode: base.recommendationMode ?? m.recommendationMode,
    intentCategory: base.intentCategory ?? m.intentCategory,
    intentStrict: base.intentStrict ?? m.intentStrict,
    mealRequired: base.mealRequired ?? m.mealRequired,
    foodSubCategory: base.foodSubCategory ?? m.foodSubCategory,
    menuIntent: base.menuIntent?.length ? base.menuIntent : m.menuIntent,
    indoorPreferred: base.indoorPreferred ?? m.indoorPreferred,
    withKids: base.withKids === true ? true : m.withKids,
    withParents: base.withParents === true ? true : m.withParents,
    queryUnderstanding: m.queryUnderstanding,
    rawQuery: base.rawQuery,
  };
}
