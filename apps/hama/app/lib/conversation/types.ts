import type { ScenarioObject } from "@/lib/scenarioEngine/types";

export type ConversationTurn = {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  /** Set when the home submits a distinct utterance, including a repeated sentence. */
  turnId?: string;
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
    query?: string;
    cards?: import("@/lib/storeTypes").HomeCard[];
  };
  rejectedPlaceIds?: string[];
  /** IntentCategory 또는 FoodSubCategory 문자열 */
  rejectedCategories?: string[];
  rejectedTags?: string[];
  /** UI·로그: 누적 사용자 문장(키워드 보조) */
  cumulativeText?: string;
  clarificationNeeded?: boolean;
  /** Question shown instead of a guessed region. */
  regionClarification?: string;
  /** Question shown when a shown place cannot be identified, or a capability limit. */
  clarificationPrompt?: string;
  /** The latest turn must not fetch or replace recommendation cards. */
  holdRecommendations?: boolean;
  capabilityClass?: "search" | "needs_detail" | "missing_data" | "external_action";
  capabilityTopic?: string;
  responseKind?: "question" | "limit" | "alternative";
  /** Added purposes that must not replace the primary recommendation list. */
  linkedPurposes?: import("./linkedPurpose").LinkedPurpose[];
  /** Play cards shown before a meal-only follow-up. */
  shownPlayCards?: import("@/lib/storeTypes").HomeCard[];
  shownPlayKey?: string;
  /** Play cards kept when the newest turn only adds a meal. */
  frozenPlayCards?: import("@/lib/storeTypes").HomeCard[];
  /** Home chat snapshots. Opening an older entry does not rank again. */
  dialogueHistory?: import("./dialogueHistory").DialogueEntry[];
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
    ambiguousShownPlace?: boolean;
  };
  /** mergeIntent 에 넘길 lock 제안 */
  suggestedLocks?: string[];
};

export type MergeIntentOptions = {
  lockedFields?: Set<string>;
  /** new_request 시 이전에서 유지할 필드 */
  preserveOnReset?: (keyof ScenarioObject)[];
};
