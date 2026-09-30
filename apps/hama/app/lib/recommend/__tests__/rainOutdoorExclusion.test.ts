import { describe, expect, it } from "vitest";
import type { HomeCard } from "@/lib/storeTypes";
import { violatesHardConstraints } from "@/lib/recommend/compositeRanking";
import { processConversationTurn } from "@/lib/conversation/processTurn";

function card(name: string, category = "activity"): HomeCard {
  return { id: name, name, category, tags: [] };
}

describe("rain keeps neighborhood parks out of the indoor pool", () => {
  it("drops a park and keeps an indoor play place", () => {
    const start = processConversationTurn("아이들과 실내 장소 찾아줘", null, { persist: false });
    const rain = processConversationTurn("비 오는 날이라 야외 활동은 빼줘", start, { persist: false, turnId: "rain" });
    expect(rain.currentIntent.indoorPreferred).toBe(true);
    expect(rain.currentIntent.hardConstraints ?? []).toContain("indoor");
    expect(violatesHardConstraints(card("느티근린공원"), rain.currentIntent)).toBe(true);
    expect(violatesHardConstraints(card("동탄 실내놀이터"), rain.currentIntent)).toBe(false);
    expect(violatesHardConstraints(card("실내 키즈놀이공원"), rain.currentIntent)).toBe(false);
  });

  it("keeps a park when the user asks for an outdoor park", () => {
    const asked = processConversationTurn("동탄에서 야외 공원 가자", null, { persist: false });
    expect(asked.currentIntent.hardConstraints ?? []).not.toContain("indoor");
    expect(violatesHardConstraints(card("느티근린공원"), asked.currentIntent)).toBe(false);
    expect(violatesHardConstraints(card("동탄 호수공원"), asked.currentIntent)).toBe(false);
  });
});
