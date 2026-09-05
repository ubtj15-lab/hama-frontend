import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import type { HomeCard } from "@/lib/storeTypes";
import {
  collapseGenericFoodRealWorldDuplicatesWithinExactFinalScoreTies,
  compareGenericFoodTiedScores,
  getConservativeRealWorldPlaceKeyForGenericFood,
  isGenericFoodScoreTieBreakQuery,
} from "../genericFoodScoreTieBreak";

type TieCandidate = {
  id: string;
  finalScore: number;
  distanceKm: number | null | undefined;
};

function sortTies(query: string, candidates: TieCandidate[]) {
  const parsed = parseScenarioIntent(query);
  return [...candidates].sort((a, b) => compareGenericFoodTiedScores(a, b, query, parsed));
}

describe("generic FOOD product tie-break (distance + duplicate collapse)", () => {
  it("applies only to generic meal queries, not DATE / INDOOR / named food", () => {
    expect(isGenericFoodScoreTieBreakQuery("뭐 먹지", parseScenarioIntent("뭐 먹지"))).toBe(true);
    expect(isGenericFoodScoreTieBreakQuery("오늘 외식할 곳", parseScenarioIntent("오늘 외식할 곳"))).toBe(true);
    expect(isGenericFoodScoreTieBreakQuery("오늘 맛있는 거 먹고 싶어", parseScenarioIntent("오늘 맛있는 거 먹고 싶어"))).toBe(true);
    expect(isGenericFoodScoreTieBreakQuery("그냥 맛있는 거 먹고 싶어", parseScenarioIntent("그냥 맛있는 거 먹고 싶어"))).toBe(true);
    expect(isGenericFoodScoreTieBreakQuery("데이트", parseScenarioIntent("데이트"))).toBe(false);
    expect(
      isGenericFoodScoreTieBreakQuery("오늘 실내에서 놀까?", parseScenarioIntent("오늘 실내에서 놀까?"))
    ).toBe(false);
    expect(
      isGenericFoodScoreTieBreakQuery("조용히 시간 보낼 곳", parseScenarioIntent("조용히 시간 보낼 곳"))
    ).toBe(false);
    expect(isGenericFoodScoreTieBreakQuery("칼국수", parseScenarioIntent("칼국수"))).toBe(false);
  });

  it("A: equal finalScore generic FOOD -> nearer exact distance wins", () => {
    const sorted = sortTies("뭐 먹지", [
      { id: "far-first", finalScore: 10, distanceKm: 2.0 },
      { id: "near-second", finalScore: 10, distanceKm: 0.1 },
    ]);
    expect(sorted[0]!.id).toBe("near-second");
  });

  it("B: farther but insertion/newer updated_at order does not win merely due to insertion", () => {
    // Comparator must decide; stable insertion order must not win when distance differs.
    const sorted = sortTies("뭐 먹지", [
      { id: "far-early", finalScore: 10, distanceKm: 2.0 },
      { id: "near-late", finalScore: 10, distanceKm: 0.1 },
    ]);
    expect(sorted[0]!.id).toBe("near-late");
  });

  it("C: exact duplicate real-world place collapses within exact finalScore ties (one result slot)", () => {
    const address = "경기도 오산시 성호대로 130 204호";
    const a: HomeCard = {
      id: "sushi-a",
      name: "특별한초밥 오산점",
      category: "restaurant",
      lat: 37.1484737560528,
      lng: 127.075804685742,
      address,
    };
    const b: HomeCard = {
      id: "sushi-b",
      name: "특별한초밥 오산점",
      category: "restaurant",
      lat: 37.1484737560528,
      lng: 127.075804685742,
      address,
    };

    const collapsed = collapseGenericFoodRealWorldDuplicatesWithinExactFinalScoreTies(
      [
        { card: a, breakdown: { finalScore: 50 } },
        { card: b, breakdown: { finalScore: 50 } },
      ],
      getConservativeRealWorldPlaceKeyForGenericFood
    );

    expect(collapsed).toHaveLength(1);
    expect(getConservativeRealWorldPlaceKeyForGenericFood(a)).toBeDefined();
  });

  it("D: same-name but different coords/address are not incorrectly deduped", () => {
    const a: HomeCard = {
      id: "x1",
      name: "특별한초밥 오산점",
      category: "restaurant",
      lat: 37.1484737560528,
      lng: 127.075804685742,
      address: "addr-a",
    };
    const b: HomeCard = {
      id: "x2",
      name: "특별한초밥 오산점",
      category: "restaurant",
      lat: 37.1484737,
      lng: 127.0758046,
      address: "addr-b",
    };

    const collapsed = collapseGenericFoodRealWorldDuplicatesWithinExactFinalScoreTies(
      [
        { card: a, breakdown: { finalScore: 50 } },
        { card: b, breakdown: { finalScore: 50 } },
      ],
      getConservativeRealWorldPlaceKeyForGenericFood
    );

    expect(collapsed).toHaveLength(2);
  });

  it("E: non-tied finalScore keeps higher score regardless of distance", () => {
    const sorted = sortTies("뭐 먹지", [
      { id: "high-far", finalScore: 100, distanceKm: 10 },
      { id: "low-near", finalScore: 1, distanceKm: 0.01 },
    ]);
    expect(sorted[0]!.id).toBe("high-far");
  });

  it("F: explicit dish/menu query does not apply tie-break (stable order preserved)", () => {
    const parsed = parseScenarioIntent("칼국수");
    const a: TieCandidate = { id: "a", finalScore: 10, distanceKm: 2 };
    const b: TieCandidate = { id: "b", finalScore: 10, distanceKm: 0.1 };

    expect(isGenericFoodScoreTieBreakQuery("칼국수", parsed)).toBe(false);
    // When tie-break is not enabled, comparator returns 0 for equal finalScore ties.
    expect(compareGenericFoodTiedScores(a, b, "칼국수", parsed)).toBe(0);

    const sorted = [...[a, b]].sort((x, y) => compareGenericFoodTiedScores(x, y, "칼국수", parsed));
    expect(sorted.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
