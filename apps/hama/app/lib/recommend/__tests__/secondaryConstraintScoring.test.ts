import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import type { HomeCard } from "@/lib/storeTypes";
import {
  applySecondaryConstraintScoring,
  collectSecondarySignals,
  SECONDARY_COMPOSITION_CAP,
  SECONDARY_RELEVANCE_BAND,
  type SecondaryCompositionDebug,
} from "../secondaryConstraintScoring";

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

function item(c: HomeCard, finalScore: number, menuTier: "exact" | "synonym" | "semantic" | "none" = "none"): {
  card: HomeCard;
  breakdown: {
    finalScore: number;
    menuTier: "exact" | "synonym" | "semantic" | "none";
    secondaryComposition?: SecondaryCompositionDebug;
  };
} {
  return {
    card: c,
    breakdown: { finalScore, menuTier },
  };
}

describe("secondary constraint scoring", () => {
  it("does not apply when query has no purpose or companion", () => {
    const parsed = parseScenarioIntent("냉면 땡겨");
    const sig = collectSecondarySignals(parsed);
    expect(sig.purposes).toEqual([]);
    expect(sig.companions).toEqual([]);
    const a = item(card({ id: "a", name: "냉면집", menu_keywords: ["냉면"] }), 80, "exact");
    const b = item(card({ id: "b", name: "다른집" }), 79);
    applySecondaryConstraintScoring([a, b], parsed);
    expect(a.breakdown.secondaryComposition?.applied).toBe(false);
    expect(a.breakdown.finalScore).toBe(80);
    expect(b.breakdown.finalScore).toBe(79);
  });

  it("reorders near-equal menu candidates by child companion without beating a large primary gap", () => {
    const parsed = parseScenarioIntent("아이랑 돈가스 먹고 싶어");
    expect(collectSecondarySignals(parsed).companions.length).toBeGreaterThan(0);
    const kidOk = card({
      id: "kid",
      name: "왕돈까스 가족식당",
      tags: ["돈까스"],
      menu_keywords: ["돈까스"],
      with_kids: true,
    });
    const kidNo = card({
      id: "nokid",
      name: "경양식 돈까스",
      tags: ["돈까스"],
      menu_keywords: ["돈까스"],
      with_kids: false,
    });
    const near = [
      item(kidNo, 88, "exact"),
      item(kidOk, 87, "exact"),
    ];
    applySecondaryConstraintScoring(near, parsed);
    expect(near[1]!.breakdown.finalScore).toBeGreaterThan(near[0]!.breakdown.finalScore);
    expect(Math.abs((near[1]!.breakdown.secondaryComposition?.totalAdjustment ?? 0))).toBeLessThanOrEqual(
      SECONDARY_COMPOSITION_CAP + 1e-9
    );

    const cafe = item(
      card({
        id: "cafe",
        name: "키즈카페 놀이터",
        category: "activity",
        tags: ["키즈카페"],
        with_kids: true,
      }),
      55,
      "none"
    );
    const don = item(kidNo, 90, "exact");
    applySecondaryConstraintScoring([don, cafe], parsed);
    expect(don.breakdown.finalScore).toBeGreaterThan(cafe.breakdown.finalScore);
    expect(cafe.breakdown.secondaryComposition?.totalAdjustment ?? 0).toBeLessThanOrEqual(0);
  });

  it("boosts brothy purpose among close restaurant scores", () => {
    const parsed = parseScenarioIntent("고기는 싫고 따뜻한 국물 먹고 싶어");
    const sig = collectSecondarySignals(parsed);
    expect(sig.purposes.some((p) => p === "brothy" || p === "hangover")).toBe(true);
    const soup = item(card({ id: "s", name: "순대국밥", tags: ["국밥"], menu_keywords: ["국밥"] }), 84);
    const meat = item(card({ id: "m", name: "삼겹살집", tags: ["삼겹살"], menu_keywords: ["삼겹살"] }), 85);
    applySecondaryConstraintScoring([meat, soup], parsed);
    expect(soup.breakdown.finalScore).toBeGreaterThan(meat.breakdown.finalScore);
  });

  it("does not lift a candidate outside the relevance band", () => {
    const parsed = parseScenarioIntent("아이랑 갈 식당");
    const leader = item(card({ id: "l", name: "한식당", with_kids: false }), 90);
    const far = item(card({ id: "f", name: "키즈 한식", with_kids: true }), 90 - SECONDARY_RELEVANCE_BAND - 1);
    applySecondaryConstraintScoring([leader, far], parsed);
    expect(far.breakdown.secondaryComposition?.reasons.some((r) => r.includes("relevance-band"))).toBe(true);
    expect(far.breakdown.finalScore).toBeLessThan(leader.breakdown.finalScore);
  });

  it("is deterministic", () => {
    const parsed = parseScenarioIntent("친구랑 한우 먹을 곳");
    const mk = () => [
      item(card({ id: "a", name: "한우A", tags: ["한우"], menu_keywords: ["한우"] }), 80, "exact"),
      item(card({ id: "b", name: "한우B 회식", tags: ["한우", "회식"], menu_keywords: ["한우"] }), 80, "exact"),
    ];
    const r1 = applySecondaryConstraintScoring(mk(), parsed);
    const r2 = applySecondaryConstraintScoring(mk(), parsed);
    expect(r1.map((x) => x.breakdown.finalScore)).toEqual(r2.map((x) => x.breakdown.finalScore));
    expect(r1.map((x) => x.breakdown.secondaryComposition?.totalAdjustment)).toEqual(
      r2.map((x) => x.breakdown.secondaryComposition?.totalAdjustment)
    );
  });
});
