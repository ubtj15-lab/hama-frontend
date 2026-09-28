import { describe, expect, it } from "vitest";
import { processConversationTurn } from "../processTurn";
import { classifyRequestCapability } from "../capability";
import { composeAssistantReply } from "../assistantReply";
import { mergeResultsScenario } from "../mergeResultsScenario";

const prompts = [
  "오늘 저녁 7시에 예약해 줘",
  "두 명이야",
  "창가 자리로 잡아 줘",
  "지금 대기 없는 곳만",
  "실시간 혼잡도 알려 줘",
  "지금 문 연 곳만",
  "밤 10시 이후에도 하는 곳",
  "콘센트 있는 곳으로",
  "강아지랑 갈 수 있는 곳",
  "1인 1만원 이하만",
  "견과 알레르기 없는 곳",
  "영어 메뉴 있는 곳",
];

describe("request capability", () => {
  it("keeps the previous trip and does not use one shared question", () => {
    let ctx = processConversationTurn("동탄에서 저녁 먹을 식당", null, { persist: false });
    const replies = new Set<string>();
    for (const line of prompts) {
      const decision = classifyRequestCapability(line, ctx);
      expect(decision.requestClass === "missing_data" || decision.requestClass === "external_action").toBe(true);
      expect(decision.holdRecommendations).toBe(true);
      ctx = processConversationTurn(line, ctx, { persist: false, turnId: line });
      expect(ctx.holdRecommendations).toBe(true);
      expect(ctx.currentIntent.intentCategory).toBe("FOOD");
      expect(ctx.currentIntent.region).toBe("동탄");
      expect(ctx.clarificationNeeded).toBe(true);
      expect(ctx.clarificationPrompt).toBeTruthy();
      replies.add(ctx.clarificationPrompt ?? "");
      const reply = composeAssistantReply({
        clarificationNeeded: true,
        clarificationText: ctx.clarificationPrompt,
        intent: ctx.currentIntent,
        placeNames: ["나오면 안 되는 식당"],
      });
      expect(reply.suppressRecommendations).toBe(true);
      expect(reply.text).not.toContain("나오면 안 되는 식당");
      expect(reply.text).not.toContain("예약했습니다");
      expect(reply.text).not.toContain("안전합니다");
    }
    expect(replies.size).toBe(prompts.length);
  });

  it("treats booking and bookable-place search differently", () => {
    const booking = classifyRequestCapability("오늘 7시에 예약해 줘", null);
    const search = classifyRequestCapability("예약 가능한 식당만 보여 줘", null);
    expect(booking.requestClass).toBe("external_action");
    expect(booking.topic).toBe("reservation_execute");
    expect(search.requestClass).toBe("missing_data");
    expect(search.topic).toBe("reservation_search");
    expect(search.responseKind).toBe("alternative");
    expect(booking.prompt).not.toBe(search.prompt);
  });

  it("does not call an allergy result safe", () => {
    const ctx = processConversationTurn("견과 알레르기 없는 곳", null, { persist: false });
    expect(ctx.clarificationPrompt).toContain("보장하지");
    expect(ctx.clarificationPrompt).not.toContain("안전합니다");
  });

  it("continues a normal place request after an unsupported turn", () => {
    let ctx = processConversationTurn("동탄에서 혼자 노트북 하기 좋은 카페", null, { persist: false });
    ctx = processConversationTurn("콘센트 있는 곳으로", ctx, { persist: false, turnId: "outlet" });
    expect(ctx.holdRecommendations).toBe(true);
    expect(ctx.currentIntent.region).toBe("동탄");
    ctx = processConversationTurn("가까운 데", ctx, { persist: false, turnId: "near" });
    expect(ctx.holdRecommendations).toBeUndefined();
    expect(ctx.clarificationNeeded).toBeUndefined();
    expect(ctx.currentIntent.intentCategory).toBe("CAFE");
    expect(ctx.currentIntent.region).toBe("동탄");
    expect(ctx.currentIntent.distanceTolerance).toBe("near_only");
  });

  it("asks for a vague outing without naming a category", () => {
    const ctx = processConversationTurn("심심한데 어디 가지", null, { persist: false });
    expect(ctx.capabilityClass).toBe("needs_detail");
    expect(ctx.holdRecommendations).toBe(true);
    expect(ctx.currentIntent.intentCategory ?? null).toBeNull();
    expect(ctx.responseKind).toBe("question");
  });

  it("reads 외식 as food without turning a booking into a search", () => {
    const meal = processConversationTurn("동탄에서 가족이랑 외식할 곳", null, { persist: false });
    expect(meal.currentIntent.intentCategory).toBe("FOOD");
    expect(meal.currentIntent.scenario === "family" || meal.currentIntent.scenario === "family_kids").toBe(true);
    expect(mergeResultsScenario("동탄에서 가족이랑 외식할 곳", meal)?.intentCategory).toBe("FOOD");
    const booking = processConversationTurn("외식 예약해 줘", meal, { persist: false, turnId: "book" });
    expect(booking.holdRecommendations).toBe(true);
    expect(booking.capabilityClass).toBe("external_action");
    expect(booking.currentIntent.region).toBe("동탄");
  });
});
