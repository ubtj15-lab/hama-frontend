import { describe, expect, it } from "vitest";
import { parseQueryNegation, cardViolatesHardNegation } from "../negationUnderstanding";
import { parseScenarioIntent } from "../parseScenarioIntent";
import { understandQuery } from "../queryUnderstanding";
import type { HomeCard } from "@/lib/storeTypes";

function card(partial: Partial<HomeCard> & Pick<HomeCard, "id" | "name" | "category">): HomeCard {
  return {
    lat: 37.15,
    lng: 127.07,
    area: null,
    address: null,
    image_url: null,
    mood: [],
    tags: [],
    description: null,
    updated_at: null,
    with_kids: null,
    for_work: null,
    reservation_required: null,
    vegetarian_available: null,
    halal_available: null,
    price_level: null,
    ...partial,
  };
}

describe("negation parser — contrastive / exclusion", () => {
  it("카페 말고 애들이랑 갈 데 → exclude CAFE, keep FAMILY/PLAY", () => {
    const n = parseQueryNegation("카페 말고 애들이랑 갈 데");
    expect(n.isNegationQuery).toBe(true);
    expect(n.excludedCategories).toContain("cafe");
    expect(n.positiveRemainder).toMatch(/애들/);
    expect(n.positivePurpose).toEqual(expect.arrayContaining(["FAMILY", "PLAY"]));
    const parsed = parseScenarioIntent("카페 말고 애들이랑 갈 데");
    expect(parsed.intentCategory).not.toBe("CAFE");
    expect(parsed.queryUnderstanding?.route).not.toBe("CAFE");
  });

  it("데이트인데 식당 말고 → exclude RESTAURANT, keep DATE", () => {
    const n = parseQueryNegation("데이트인데 식당 말고");
    expect(n.excludedCategories).toContain("restaurant");
    expect(n.positivePurpose).toContain("DATE");
    const parsed = parseScenarioIntent("데이트인데 식당 말고");
    expect(parsed.intentCategory).not.toBe("FOOD");
    expect(parsed.scenario).toBe("date");
  });

  it("고기는 싫고 따뜻한 국물 먹고 싶어 → exclude meat, keep soup", () => {
    const n = parseQueryNegation("고기는 싫고 따뜻한 국물 먹고 싶어");
    expect(n.excludedMenus).toContain("고기");
    expect(n.positivePurpose).toContain("SOUP");
    const uq = understandQuery("고기는 싫고 따뜻한 국물 먹고 싶어");
    expect(uq.menuIntents ?? []).not.toContain("고기");
    expect(uq.purposeIntents ?? []).toEqual(expect.arrayContaining(["brothy"]));
    const steak = card({ id: "s", name: "숯불고깃집", category: "restaurant", tags: ["삼겹살"] });
    const soup = card({ id: "g", name: "순대국밥", category: "restaurant", tags: ["국밥"] });
    expect(cardViolatesHardNegation(steak, n)).toBe(true);
    expect(cardViolatesHardNegation(soup, n)).toBe(false);
  });

  it("밥은 이미 먹었고 커피 마실 곳 → MEAL suppressed, CAFE positive", () => {
    const n = parseQueryNegation("밥은 이미 먹었고 커피 마실 곳");
    expect(n.suppressedIntents).toContain("MEAL");
    expect(n.positivePurpose).toContain("CAFE");
    const parsed = parseScenarioIntent("밥은 이미 먹었고 커피 마실 곳");
    expect(parsed.intentCategory).toBe("CAFE");
    expect(parsed.mealRequired).not.toBe(true);
  });

  it("야외는 싫고 실내에서 놀고 싶어 → OUTDOOR excluded, INDOOR/PLAY positive", () => {
    const n = parseQueryNegation("야외는 싫고 실내에서 놀고 싶어");
    expect(n.excludedContexts).toContain("outdoor");
    expect(n.positivePurpose).toEqual(expect.arrayContaining(["INDOOR", "PLAY"]));
    const parsed = parseScenarioIntent("야외는 싫고 실내에서 놀고 싶어");
    expect(parsed.indoorPreferred).toBe(true);
  });

  it("키즈카페 말고 아이가 놀 수 있는 곳 → KIDS_CAFE excluded, FAMILY/PLAY kept", () => {
    const n = parseQueryNegation("키즈카페 말고 아이가 놀 수 있는 곳");
    expect(n.excludedVenues).toContain("kids_cafe");
    expect(n.excludedCategories).not.toContain("activity");
    expect(n.positivePurpose).toEqual(expect.arrayContaining(["FAMILY", "PLAY"]));
    const parsed = parseScenarioIntent("키즈카페 말고 아이가 놀 수 있는 곳");
    expect(parsed.menuIntent ?? []).not.toContain("키즈카페");
    const kids = card({ id: "k", name: "아이랑키즈카페", category: "activity", tags: ["키즈카페"] });
    const park = card({ id: "p", name: "근린공원", category: "activity", tags: ["공원"] });
    expect(cardViolatesHardNegation(kids, n)).toBe(true);
    expect(cardViolatesHardNegation(park, n)).toBe(false);
  });
});

describe("negation parser — false positives", () => {
  it("does not treat ordinary positive queries as exclusions", () => {
    const queries = [
      "카페 추천",
      "고기 먹고 싶어",
      "야외 나들이",
      "키즈카페 있는 곳",
      "식당 추천",
      "밥 먹을 곳",
      "데이트 카페",
      "공원 가고 싶어",
      "실내 놀거리",
    ];
    for (const q of queries) {
      const n = parseQueryNegation(q);
      expect(n.isNegationQuery, q).toBe(false);
      expect(n.excludedCategories, q).toEqual([]);
      expect(n.excludedMenus, q).toEqual([]);
      expect(n.excludedVenues, q).toEqual([]);
      expect(n.suppressedIntents, q).toEqual([]);
    }
  });
});
