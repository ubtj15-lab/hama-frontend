import { describe, expect, it } from "vitest";
import type { HomeCard } from "@/lib/storeTypes";
import { violatesHardConstraints } from "@/lib/recommend/compositeRanking";
import { processConversationTurn } from "@/lib/conversation/processTurn";
import { parseScenarioIntent } from "@/lib/scenarioEngine/intentClassification";
import { parseQueryNegation } from "@/lib/scenarioEngine/negationUnderstanding";
import { classifyDiscoveryQuery } from "@/lib/recommend/discoveryRole";

function card(name: string, category = "activity"): HomeCard {
  return { id: name, name, category, tags: [] };
}

describe("family indoor requests stay separate from date outings", () => {
  it("does not turn a rainy kids indoor request into a date", () => {
    const parsed = parseScenarioIntent("오산에서 아이들이랑 비 오는 날 실내에서 놀 만한 곳");
    expect(parsed.scenario).not.toBe("date");
    expect(parsed.withKids).toBe(true);
    expect(parsed.indoorPreferred).toBe(true);
    expect(classifyDiscoveryQuery("오산에서 아이들이랑 비 오는 날 실내에서 놀 만한 곳", parsed).role).not.toBe("DATE");
  });

  it("still treats a rainy date as a date", () => {
    expect(parseScenarioIntent("비 오는 날 데이트").scenario).toBe("date");
  });

  it("treats an excluded kids cafe as an exclusion, not the venue to find", () => {
    const text = "동탄에서 아이들과 실내에서 놀 곳, 키즈카페는 제외";
    expect(parseQueryNegation(text).excludedVenues).toContain("kids_cafe");
    const parsed = parseScenarioIntent(text);
    const found = classifyDiscoveryQuery(text, parsed);
    expect(found).toMatchObject({ role: "PLAY" });
  });
});

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
