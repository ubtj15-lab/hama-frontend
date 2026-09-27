import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import {
  evaluateStrictCategoryCompatibility,
  isFoodQualifiedMenuTerm,
  qualifyMenuProtection,
  queryHasExplicitCafePlace,
} from "../strictCategoryCompatibility";

function card(p: Partial<HomeCard> & { id: string; name: string }): HomeCard {
  return {
    category: "restaurant",
    lat: 37.15,
    lng: 127.08,
    tags: [],
    mood: [],
    ...p,
  } as HomeCard;
}

function withMenus(parsed: ScenarioObject, menus: string[]): ScenarioObject {
  return { ...parsed, menuIntent: menus };
}

const library = () =>
  card({
    id: "lib",
    name: "시립중앙도서관",
    category: "library",
    tags: ["도서관", "책", "독서"],
  });

describe("strict category compatibility", () => {
  it("keeps exact category match", () => {
    const parsed = parseScenarioIntent("놀거리 추천");
    const activity = card({ id: "a", name: "실내 체험관", category: "activity", tags: ["체험"] });
    const r = evaluateStrictCategoryCompatibility(activity, parsed);
    expect(r.baseCategoryMatch).toBe(true);
    expect(r.compatibilityApplied).toBe(false);
    expect(r.finalDecision).toBe("KEEP");
  });

  it("keeps ACTIVITY + culture with strong culture-compatible cross-category candidate", () => {
    const parsed = parseScenarioIntent("아이랑 전시나 문화 볼 곳");
    expect(parsed.intentCategory).toBe("ACTIVITY");
    expect(parsed.queryUnderstanding?.purposeIntents ?? []).toEqual(expect.arrayContaining(["culture"]));
    const r = evaluateStrictCategoryCompatibility(library(), parsed);
    expect(r.baseCategoryMatch).toBe(false);
    expect(r.compatibilityApplied).toBe(true);
    expect(r.finalDecision).toBe("KEEP");
    expect(r.candidateEvidence.length).toBeGreaterThan(0);
  });

  it("drops ACTIVITY + unrelated restaurant", () => {
    const parsed = parseScenarioIntent("아이랑 전시나 문화 볼 곳");
    const steak = card({ id: "s", name: "한우 숯불구이", category: "restaurant", tags: ["고기", "삼겹"] });
    const r = evaluateStrictCategoryCompatibility(steak, parsed);
    expect(r.finalDecision).toBe("DROP");
    expect(r.compatibilityApplied).toBe(false);
  });

  it("drops explicit CAFE + generic restaurant", () => {
    const parsed = parseScenarioIntent("카페 추천");
    expect(queryHasExplicitCafePlace("카페 추천")).toBe(true);
    const restaurant = card({ id: "r", name: "김치찌개 백반", category: "restaurant", tags: ["한식"] });
    const r = evaluateStrictCategoryCompatibility(restaurant, parsed);
    expect(r.explicitCategoryProtected).toBe(true);
    expect(r.finalDecision).toBe("DROP");
  });

  it("keeps CAFE + brunch restaurant with strong brunch evidence", () => {
    const parsed = parseScenarioIntent("늦은 브런치 접시 나오는 곳");
    expect(parsed.intentCategory).toBe("CAFE");
    expect(queryHasExplicitCafePlace("늦은 브런치 접시 나오는 곳")).toBe(false);
    const brunch = card({
      id: "b",
      name: "주말 브런치 키친",
      category: "restaurant",
      tags: ["브런치", "에그베네딕트"],
    });
    const r = evaluateStrictCategoryCompatibility(brunch, parsed);
    expect(r.finalDecision).toBe("KEEP");
    expect(r.compatibilityApplied).toBe(true);
  });

  it("keeps CAFE + dessert candidate with dessert purpose", () => {
    const parsed = parseScenarioIntent("케이크 디저트 천천히");
    expect(parsed.intentCategory).toBe("CAFE");
    const dessertCafe = card({
      id: "d",
      name: "마카롱 디저트 카페",
      category: "cafe",
      tags: ["디저트", "케이크", "마카롱"],
    });
    const r = evaluateStrictCategoryCompatibility(dessertCafe, parsed);
    expect(r.finalDecision).toBe("KEEP");
  });

  it("keeps ACTIVITY + play candidate with play purpose", () => {
    const parsed = parseScenarioIntent("아이랑 뛰어놀 실내 체험");
    const play = card({
      id: "p",
      name: "키즈 실내 놀이터",
      category: "activity",
      tags: ["놀이", "체험"],
    });
    const r = evaluateStrictCategoryCompatibility(play, parsed);
    expect(r.finalDecision).toBe("KEEP");
  });

  it("drops strong menu query + unrelated cross-category purpose candidate", () => {
    const parsed = parseScenarioIntent("아이랑 돈가스 먹을 곳");
    expect(parsed.intentCategory).toBe("FOOD");
    const r = evaluateStrictCategoryCompatibility(library(), parsed);
    expect(r.finalDecision).toBe("DROP");
    expect(r.menuProtected || r.compatibilityReason === "route-not-compatible" || r.compatibilityReason === "menu-protected").toBe(
      true
    );
  });

  it("drops negation-excluded category even when purpose-compatible", () => {
    const parsed = parseScenarioIntent("카페 말고 아이랑 갈 곳");
    const cafe = card({
      id: "c",
      name: "브런치 카페",
      category: "cafe",
      tags: ["브런치", "커피"],
    });
    const r = evaluateStrictCategoryCompatibility(cafe, parsed);
    expect(r.finalDecision).toBe("DROP");
    expect(r.negationBlocked).toBe(true);
  });

  it("is deterministic for the same input", () => {
    const parsed = withMenus(parseScenarioIntent("아이랑 전시나 문화 볼 곳"), ["학생"]);
    const a = evaluateStrictCategoryCompatibility(library(), parsed);
    const b = evaluateStrictCategoryCompatibility(library(), parsed);
    expect(a).toEqual(b);
  });
});

describe("food-qualified menu protection", () => {
  it("keeps culture + library when menu-like token is not food-qualified", () => {
    const parsed = withMenus(parseScenarioIntent("아이랑 전시나 문화 볼 곳"), ["학생"]);
    const prot = qualifyMenuProtection(parsed);
    expect(prot.resolvedMenuIntents).toEqual(["학생"]);
    expect(prot.foodQualifiedMenuIntents).toEqual([]);
    expect(prot.rejectedNonFoodMenuIntents).toEqual(["학생"]);
    expect(prot.hasStrongPrimaryMenu).toBe(false);
    expect(prot.protectionApplied).toBe(false);
    const r = evaluateStrictCategoryCompatibility(library(), parsed);
    expect(r.menuProtected).toBe(false);
    expect(r.compatibilityApplied).toBe(true);
    expect(r.finalDecision).toBe("KEEP");
  });

  it("keeps menu protection when culture + library meets a real FOOD menu", () => {
    const parsed = withMenus(parseScenarioIntent("아이랑 전시나 문화 볼 곳"), ["돈가스"]);
    const prot = qualifyMenuProtection(parsed);
    expect(prot.foodQualifiedMenuIntents.length).toBeGreaterThan(0);
    expect(prot.protectionApplied).toBe(true);
    const r = evaluateStrictCategoryCompatibility(library(), parsed);
    expect(r.menuProtected).toBe(true);
    expect(r.finalDecision).toBe("DROP");
    expect(r.compatibilityReason).toBe("menu-protected");
  });

  it("does not let a non-food token alone activate menu-protected", () => {
    expect(isFoodQualifiedMenuTerm("학생")).toBe(false);
    const parsed = withMenus(parseScenarioIntent("아이랑 전시나 문화 볼 곳"), ["학생"]);
    expect(qualifyMenuProtection(parsed).protectionApplied).toBe(false);
    expect(evaluateStrictCategoryCompatibility(library(), parsed).menuProtected).toBe(false);
  });

  it("keeps protection when food-qualified and non-food tokens are mixed", () => {
    const parsed = withMenus(parseScenarioIntent("아이랑 전시나 문화 볼 곳"), ["학생", "돈까스"]);
    const prot = qualifyMenuProtection(parsed);
    expect(prot.foodQualifiedMenuIntents).toEqual(expect.arrayContaining(["돈까스"]));
    expect(prot.rejectedNonFoodMenuIntents).toEqual(expect.arrayContaining(["학생"]));
    expect(prot.protectionApplied).toBe(true);
    const r = evaluateStrictCategoryCompatibility(library(), parsed);
    expect(r.menuProtected).toBe(true);
    expect(r.finalDecision).toBe("DROP");
  });

  it("keeps real explicit FOOD menu protection", () => {
    for (const q of ["돈가스 먹을 곳", "칼국수 먹고 싶어", "냉면", "소금빵"]) {
      const parsed = parseScenarioIntent(q);
      const r = evaluateStrictCategoryCompatibility(library(), parsed);
      expect(r.finalDecision).toBe("DROP");
      expect(
        r.menuProtected ||
          r.compatibilityReason === "menu-protected" ||
          r.compatibilityReason === "route-not-compatible" ||
          r.explicitCategoryProtected
      ).toBe(true);
    }
  });

  it("qualifies known food terms and rejects companion-like tokens", () => {
    expect(isFoodQualifiedMenuTerm("돈가스")).toBe(true);
    expect(isFoodQualifiedMenuTerm("칼국수")).toBe(true);
    expect(isFoodQualifiedMenuTerm("학생")).toBe(false);
    expect(isFoodQualifiedMenuTerm("초등학생")).toBe(false);
  });
});
