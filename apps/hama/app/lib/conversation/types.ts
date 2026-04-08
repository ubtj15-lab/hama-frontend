import type { ScenarioObject } from "@/lib/scenarioEngine/types";

export type ConversationTurn = {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
};

export type RefinementType =
  | "new_request"
  | "refine"
  | "reject"
  | "narrow"
  | "broaden"
  | "clarify";

export type ConversationContext = {
  sessionId: string;
  turns: ConversationTurn[];
  currentIntent: ScenarioObject;
  lockedFields?: string[];
  lastRecommendations?: {
    placeIds?: string[];
    courseIds?: string[];
  };
  rejectedPlaceIds?: string[];
  /** IntentCategory 또는 FoodSubCategory 문자열 */
  rejectedCategories?: string[];
  rejectedTags?: string[];
  /** UI·로그: 누적 사용자 문장(키워드 보조) */
  cumulativeText?: string;
  clarificationNeeded?: boolean;
};

export type ParseTurnResult = {
  refinementType: RefinementType;
  partialIntent: Partial<ScenarioObject>;
  /** 거절 시 컨텍스트 패치 */
  rejection?: {
    rejectShownPlaces?: boolean;
    addRejectedCategory?: string;
    addRejectedTag?: string;
    removeMenuIntent?: string;
    removeFoodSubCategory?: boolean;
    broadenFood?: boolean;
  };
  /** mergeIntent 에 넘길 lock 제안 */
  suggestedLocks?: string[];
};

export type MergeIntentOptions = {
  lockedFields?: Set<string>;
  /** new_request 시 이전에서 유지할 필드 */
  preserveOnReset?: (keyof ScenarioObject)[];
};
