import type { FoodSubCategory, ScenarioObject } from "@/lib/scenarioEngine/types";

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr.filter((x) => x != null && x !== ""))] as T[];
}

export type ConversationRejectPatch = {
  rejectedPlaceIds?: string[];
  rejectedCategories?: string[];
  rejectedTags?: string[];
};

/**
 * 컨텍스트의 거절·누적 메모를 ScenarioObject 에 엔진이 읽을 필드로 반영.
 */
export function applyConversationMemory(
  intent: ScenarioObject,
  patch: ConversationRejectPatch
): ScenarioObject {
  const excludeIds = uniq([...(intent.conversationExcludePlaceIds ?? []), ...(patch.rejectedPlaceIds ?? [])]);

  const rejectedSubs: FoodSubCategory[] = [];
  for (const c of patch.rejectedCategories ?? []) {
    const u = String(c).toUpperCase();
    if (u === "CHINESE" || u === "JAPANESE" || u === "KOREAN" || u === "WESTERN" || u === "FASTFOOD") {
      rejectedSubs.push(u as FoodSubCategory);
    }
  }
  const subs = uniq([...(intent.conversationRejectedFoodSubs ?? []), ...rejectedSubs]);

  const menuTerms = uniq([...(intent.conversationExcludeMenuTerms ?? []), ...(patch.rejectedTags ?? [])]);

  return {
    ...intent,
    conversationExcludePlaceIds: excludeIds.length ? excludeIds : undefined,
    conversationRejectedFoodSubs: subs.length ? subs : undefined,
    conversationExcludeMenuTerms: menuTerms.length ? menuTerms : undefined,
  };
}

/** rejectedCategories 문자열 정규화 */
export function normalizeRejectedCategory(token: string): string | null {
  const u = String(token).toUpperCase();
  if (["CHINESE", "JAPANESE", "KOREAN", "WESTERN", "FASTFOOD", "CAFE", "FOOD", "ACTIVITY", "BEAUTY"].includes(u))
    return u;
  return null;
}
