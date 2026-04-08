import { parseScenarioIntent } from "@/lib/scenarioEngine/intentClassification";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import type { ConversationContext } from "./types";

/**
 * 결과 페이지 전용: 후보 풀·랭킹 분기(intentType / intentCategory / FOOD 세부)는
 * 항상 현재 URL 쿼리(`parseScenarioIntent`) 기준으로 고정하고,
 * 대화 컨텍스트의 메모리·누적 조건만 얹습니다.
 *
 * convCtx 가 늦게 올라오며 `currentIntent` 만 쓰면 intent 가 바뀌어
 * 식당 풀 → 전체(all) 풀로 갈아타는 깜빡임이 날 수 있어 이 병합을 둡니다.
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
  return {
    ...m,
    intentType: base.intentType,
    recommendationMode: base.recommendationMode,
    intentCategory: base.intentCategory,
    intentStrict: base.intentStrict,
    foodSubCategory: base.foodSubCategory ?? m.foodSubCategory,
    menuIntent: base.menuIntent?.length ? base.menuIntent : m.menuIntent,
    rawQuery: base.rawQuery,
  };
}
