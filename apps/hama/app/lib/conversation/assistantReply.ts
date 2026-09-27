import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import type { ConversationContext, ConversationTurn } from "./types";
import { summarizeActiveConstraints } from "./summarize";
import { loadConversationContext, saveConversationContext, canWriteRecommendationsForQuery } from "./storage";

export type AssistantReply = {
  text: string;
  suppressRecommendations: boolean;
};

function conditionLine(intent: ScenarioObject): string {
  const labels = summarizeActiveConstraints(intent).map((chip) => chip.label);
  if (intent.weatherHint === "rain") labels.push("비 오는 날");
  if (intent.weatherHint === "snow") labels.push("눈 오는 날");
  return [...new Set(labels)].join(", ");
}

/**
 * Reply copy from the intent already used for ranking and the places actually shown.
 * Store names come only from the caller. This module does not rank or call a model.
 */
export function composeAssistantReply(input: {
  clarificationNeeded?: boolean;
  intent: ScenarioObject;
  placeNames: readonly string[];
  excludedPlaceCount?: number;
  clarificationText?: string;
  /** A meal request was stored beside the current list, not ranked as this list. */
  linkedFoodKeptSeparate?: boolean;
  foodPlaceNames?: readonly string[];
  foodNearNeedsAnchor?: boolean;
  foodAnchorNote?: string;
  indoorEvidenceOnly?: boolean;
}): AssistantReply {
  const conditions = conditionLine(input.intent);
  const excluded =
    (input.excludedPlaceCount ?? 0) > 0 ? "앞에서 보여 드린 곳은 빼 두었어요. " : "";

  if (input.clarificationNeeded) {
    if (input.clarificationText) {
      return { suppressRecommendations: true, text: input.clarificationText };
    }
    const known = conditions ? `지금은 ${conditions}까지 알겠어요. ` : "";
    return {
      suppressRecommendations: true,
      text: `${known}아직 장소를 고르지는 않을게요. 아이와 가는 곳인지, 식사인지, 어디쯤인지를 한 가지만 더 말해 주세요.`,
    };
  }

  const names = input.placeNames.map((name) => name.trim()).filter(Boolean);
  const foodNames = (input.foodPlaceNames ?? []).map((name) => name.trim()).filter(Boolean);
  const foodLine = !input.linkedFoodKeptSeparate
    ? ""
    : input.foodNearNeedsAnchor
      ? " 가까운 식당의 거리를 보려면 놀이 장소 하나를 기준으로 골라 주세요."
      : foodNames.length
        ? ` 식사 쪽은 이 순서로 골랐어요: ${foodNames.join(", ")}.${input.foodAnchorNote ?? ""}`
        : ` 식사 조건은 기억했지만, 보여줄 식당이 없어요.${input.foodAnchorNote ?? ""}`;
  const separate = foodLine;
  const indoorNote = input.indoorEvidenceOnly
    ? " 이름에 실내·키즈카페·보드게임이 없는 장소는 넣지 않았어요. 이건 영업장 실내 여부의 확인이 아니라 이름 추정입니다."
    : "";
  if (!names.length) {
    const basis = conditions ? `${conditions} 기준으로 찾아봤는데, ` : "";
    return {
      suppressRecommendations: false,
      text: `${excluded}${basis}지금 보여드릴 곳이 없어요. 조건을 조금 바꿔 주세요.${separate}${indoorNote}`,
    };
  }

  const basis = conditions ? `${conditions} 기준으로 ` : "";
  return {
    suppressRecommendations: false,
    text: `${excluded}${basis}이 순서로 골랐어요: ${names.join(", ")}.${separate}${indoorNote}`,
  };
}

export function withAssistantReply(context: ConversationContext, text: string): ConversationContext {
  const reply = text.trim();
  if (!reply) return context;
  const turns = context.turns;
  const last = turns[turns.length - 1];
  if (last?.role === "assistant" && last.text === reply) return context;
  const nextTurn: ConversationTurn = { role: "assistant", text: reply, timestamp: Date.now() };
  const nextTurns =
    last?.role === "assistant" ? [...turns.slice(0, -1), nextTurn] : [...turns, nextTurn];
  return { ...context, turns: nextTurns };
}

/** Writes the assistant line onto the stored session without dropping recommendation memory. */
export function persistAssistantReply(text: string, forQuery?: string): ConversationContext | null {
  const prev = loadConversationContext();
  if (!prev) return null;
  if (!canWriteRecommendationsForQuery(prev, forQuery)) return prev;
  const next = withAssistantReply(prev, text);
  if (next === prev) return prev;
  saveConversationContext(next);
  return next;
}
