import { describe, expect, it } from "vitest";
import type { HomeCard } from "@/lib/storeTypes";
import { parseScenarioIntent } from "@/lib/scenarioEngine/intentClassification";
import { scenarioTypeToRankKey } from "@/lib/scenarioEngine/scenarioRankBridge";
import { buildHomeRecommendationReason } from "@/lib/recommend/reasonPhrases";
import { classifyDiscoveryQuery } from "@/lib/recommend/discoveryRole";

function reason(voice: "family" | "solo" | "date", card: Partial<HomeCard>): string {
  return buildHomeRecommendationReason({
    voice,
    intent: voice === "family" ? "family" : voice === "date" ? "date" : "solo",
    business: "UNKNOWN",
    km: null,
    blob: [card.name, ...(card.tags ?? [])].join(" "),
    withKids: card.with_kids === true,
    category: card.category,
  });
}

describe("explicit child age and kids meals stay a family context", () => {
  it("keeps a 7-year-old outing as family without forcing a kids cafe search", () => {
    const parsed = parseScenarioIntent("오산에서 7살 아이와 갈 만한 곳 찾아줘");
    expect(parsed.scenario).toBe("family_kids");
    expect(parsed.withKids).toBe(true);
    expect(parsed.scenario).not.toBe("solo");
    expect(parsed.intentCategory).not.toBe("ACTIVITY");
    expect(scenarioTypeToRankKey(parsed.scenario)).toBe("family");
    expect(classifyDiscoveryQuery("오산에서 7살 아이와 갈 만한 곳 찾아줘", parsed).role).not.toBe("DATE");
  });

  it("connects an explicit play request to activity", () => {
    const parsed = parseScenarioIntent("일곱 살 아이와 놀 만한 곳");
    expect(parsed.scenario).toBe("family_kids");
    expect(parsed.withKids).toBe(true);
    expect(classifyDiscoveryQuery("일곱 살 아이와 놀 만한 곳", parsed).role).toBe("FAMILY_OUTING");
  });

  it("keeps a kids meal as food and does not describe it as eating alone", () => {
    const parsed = parseScenarioIntent("오산에서 아이들과 식사할 곳 찾아줘");
    expect(parsed.intentCategory).toBe("FOOD");
    expect(parsed.scenario).toBe("family_kids");
    expect(scenarioTypeToRankKey(parsed.scenario)).toBe("family");
    const plain = reason("family", { name: "새말해장국", category: "restaurant", with_kids: true, tags: ["아이동반"] });
    expect(plain).not.toContain("혼밥");
    expect(plain).not.toContain("아이 동반에 무난");
    expect(plain).toContain("가족");
    expect(plain).toContain("방문 전 확인");
    expect(plain).not.toContain("아이동반가능");
    const evidenced = reason("family", { name: "키즈카페 식당", category: "restaurant", with_kids: true, tags: ["키즈카페"] });
    expect(evidenced).toContain("아이 동반");
  });

  it("keeps noodle meals, solo meals, rainy dates, and plain cafes on their own paths", () => {
    const noodle = parseScenarioIntent("아이들과 칼국수 먹을 곳");
    expect(noodle.intentCategory).toBe("FOOD");
    expect(noodle.scenario).toBe("family_kids");
    expect(noodle.menuIntent ?? []).toContain("칼국수");
    const solo = parseScenarioIntent("혼자 밥 먹을 곳");
    expect(solo.scenario).toBe("solo");
    expect(scenarioTypeToRankKey(solo.scenario)).toBe("solo");
    expect(reason("solo", { name: "국밥", category: "restaurant", with_kids: false })).toContain("혼밥");
    expect(parseScenarioIntent("비 오는 날 데이트").scenario).toBe("date");
    const cafe = parseScenarioIntent("카페 추천");
    expect(cafe.intentCategory).toBe("CAFE");
    expect(cafe.scenario).not.toBe("family_kids");
  });
});
