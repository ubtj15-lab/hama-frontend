import { describe, expect, it } from "vitest";
import { processConversationTurn } from "../processTurn";
import { classifyRequestCapability } from "../capability";
import { classifyShownExclusion } from "../shownReference";
import { resolveConversationTurnOutcome } from "@/lib/analytics/conversationTurnOutcome";
import type { ConversationContext } from "../types";

function withCards(ctx: ConversationContext, cards: Array<{ id: string; name: string }>): ConversationContext {
  return {
    ...ctx,
    lastRecommendations: {
      placeIds: cards.map((card) => card.id),
      cards: cards.map((card) => ({ id: card.id, name: card.name, category: "food" })),
    },
  };
}

describe("paraphrase understanding", () => {
  it("rejects the whole shown list, one named place, or asks when the place is unclear", () => {
    const food = withCards(processConversationTurn("동탄에서 저녁 먹을 식당", null, { persist: false }), [
      { id: "r1", name: "동탄 식당 한" },
      { id: "r2", name: "동탄 식당 둘" },
    ]);
    const other = processConversationTurn("그럼 그냥 다른 식당", food, { persist: false, turnId: "other" });
    expect(other.holdRecommendations).toBeUndefined();
    expect(other.rejectedPlaceIds).toEqual(["r1", "r2"]);
    expect(other.currentIntent.intentCategory).toBe("FOOD");
    expect(other.currentIntent.region).toBe("동탄");

    const again = processConversationTurn("다른 집으로", food, { persist: false, turnId: "house" });
    expect(again.rejectedPlaceIds).toEqual(["r1", "r2"]);
    const list = processConversationTurn("이 목록 말고", food, { persist: false, turnId: "list" });
    expect(list.rejectedPlaceIds).toEqual(["r1", "r2"]);

    const plural = processConversationTurn("그 집들은 말고", food, { persist: false, turnId: "plural" });
    expect(plural.clarificationNeeded).toBeUndefined();
    expect(plural.rejectedPlaceIds).toEqual(["r1", "r2"]);

    const vague = processConversationTurn("그 집은 말고", food, { persist: false, turnId: "vague" });
    expect(vague.clarificationNeeded).toBe(true);
    expect(vague.rejectedPlaceIds).toBeUndefined();
    expect(classifyShownExclusion("그 집은 말고", food).kind).toBe("ambiguous");

    const named = processConversationTurn("동탄 식당 한은 빼 줘", food, { persist: false, turnId: "named" });
    expect(named.rejectedPlaceIds).toEqual(["r1"]);
  });

  it("does not treat a different menu, a first turn, or a calm preference as list rejection or live congestion", () => {
    const first = processConversationTurn("다른 식당 알려 줘", null, { persist: false });
    expect(first.rejectedPlaceIds).toBeUndefined();
    expect(first.holdRecommendations).toBeUndefined();
    expect(first.currentIntent.intentCategory).toBe("FOOD");

    const food = withCards(processConversationTurn("동탄 맛집", null, { persist: false }), [
      { id: "f1", name: "맛집 한" },
      { id: "f2", name: "맛집 둘" },
    ]);
    const menu = processConversationTurn("파스타 말고 다른 메뉴", food, { persist: false, turnId: "menu" });
    expect(menu.rejectedPlaceIds).toBeUndefined();
    expect(menu.holdRecommendations).toBeUndefined();

    const calm = processConversationTurn("너무 복잡하지 않은 데", food, { persist: false, turnId: "calm" });
    expect(calm.holdRecommendations).toBeUndefined();
    expect(calm.capabilityClass).toBeUndefined();
    expect(calm.currentIntent.activityLevel).toBe("calm");

    const popular = processConversationTurn("사람 많은 맛집 추천해 줘", food, { persist: false, turnId: "popular" });
    expect(popular.holdRecommendations).toBeUndefined();
    expect(classifyRequestCapability("사람 많은 맛집 추천해 줘", food).topic).toBeNull();
    expect(classifyRequestCapability("한산한 곳으로", food).requestClass).toBe("search");
  });

  it("understands crowd, english menu, booking, and arrival paraphrases without inventing facts", () => {
    const food = processConversationTurn("동탄에서 저녁 먹을 식당", null, { persist: false });
    const crowd = processConversationTurn("지금 사람 많아?", food, { persist: false, turnId: "crowd" });
    expect(crowd.capabilityTopic).toBe("congestion");
    expect(crowd.holdRecommendations).toBe(true);
    expect(crowd.currentIntent.region).toBe("동탄");
    expect(crowd.clarificationPrompt).not.toContain("한산해요");

    const busy = processConversationTurn("북적여?", food, { persist: false, turnId: "busy" });
    expect(busy.capabilityTopic).toBe("congestion");
    const quiet = processConversationTurn("한가해?", food, { persist: false, turnId: "quiet" });
    expect(quiet.capabilityTopic).toBe("congestion");

    const english = processConversationTurn("메뉴가 영어로 돼 있어?", food, { persist: false, turnId: "en" });
    expect(english.capabilityTopic).toBe("english_menu");
    expect(english.holdRecommendations).toBe(true);
    expect(english.clarificationPrompt).not.toContain("영어 메뉴가 있어요");
    const englishMenu = processConversationTurn("영어로 된 메뉴 있어?", food, { persist: false, turnId: "en2" });
    expect(englishMenu.capabilityTopic).toBe("english_menu");
    const study = processConversationTurn("영어 공부하기 좋은 카페", null, { persist: false });
    expect(study.capabilityTopic).toBeUndefined();
    expect(study.currentIntent.intentCategory).toBe("CAFE");

    const table = processConversationTurn("테이블 좀 잡아 줄래", food, { persist: false, turnId: "table" });
    expect(table.capabilityClass).toBe("external_action");
    expect(table.capabilityTopic).toBe("reservation_execute");
    expect(table.holdRecommendations).toBe(true);
    expect(table.currentIntent.intentCategory).toBe("FOOD");
    expect(table.clarificationPrompt).not.toContain("예약했습니다");
    expect(table.clarificationPrompt).not.toContain("잡아 드렸어요");

    const hold = processConversationTurn("자리 좀 맡아 줘", food, { persist: false, turnId: "hold" });
    expect(hold.capabilityTopic).toBe("reservation_execute");
    const party = processConversationTurn("다섯 명으로 부탁해", table, { persist: false, turnId: "party" });
    expect(party.capabilityTopic).toBe("party_size");
    expect(party.currentIntent.region).toBe("동탄");

    const findTable = processConversationTurn("테이블 있는 카페 찾아 줘", null, { persist: false });
    expect(findTable.holdRecommendations).toBeUndefined();
    expect(findTable.currentIntent.intentCategory).toBe("CAFE");

    const seat = processConversationTurn("창가 자리로 잡아 줘", food, { persist: false, turnId: "seat" });
    expect(seat.capabilityTopic).toBe("seat");
    const corner = processConversationTurn("코너석으로 지정해 줘", food, { persist: false, turnId: "corner" });
    expect(corner.capabilityTopic).toBe("seat");
    expect(corner.clarificationPrompt).not.toContain("지정해 드렸어요");

    const arrive = processConversationTurn("문 닫기 전에 갈 수 있는 곳", food, { persist: false, turnId: "arrive" });
    expect(arrive.capabilityTopic).toBe("hours_after");
    expect(arrive.holdRecommendations).toBe(true);
    expect(arrive.currentIntent.region).toBe("동탄");
    expect(arrive.clarificationPrompt).toContain("보장하지");
    expect(arrive.clarificationPrompt).not.toContain("도착할 수 있어요");
    expect(arrive.clarificationPrompt).not.toContain("갈 수 있어요");
    expect(classifyRequestCapability("마감 전에 도착할 수 있어?", food).topic).toBe("hours_after");
    expect(classifyRequestCapability("문 닫히기 전에 도착할 수 있어?", food).topic).toBe("hours_after");
    expect(classifyRequestCapability("아직 문 열었어?", food).topic).toBe("open_now");
  });

  it("leaves an unfinished clarification turn out of the outcome record", () => {
    expect(
      resolveConversationTurnOutcome({
        pending: true,
        shownCardCount: 3,
        suppressionFailed: false,
        fetchFailed: false,
      })
    ).toBeNull();
  });
});
