import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { classifyDiscoveryQuery } from "../discoveryRole";
import { getHomeSituationCandidate } from "@/_components/home/homeSituationCandidates";

function roleOf(q: string) {
  return classifyDiscoveryQuery(q, parseScenarioIntent(q)).role;
}

describe("RELAX semantic routing V1", () => {
  it("recognizes 쉬다 / 쉬기 / 머물다 / 차분하게 / 시간 보내고 as RELAX", () => {
    expect(roleOf("편하게 쉬다 올 곳")).toBe("RELAX");
    expect(roleOf("복잡하지 않고 쉬기 좋은 곳")).toBe("RELAX");
    expect(roleOf("편하게 머물다 올 곳")).toBe("RELAX");
    expect(roleOf("차분하게 있을 곳")).toBe("RELAX");
    expect(roleOf("조용히 시간 보내고 싶어")).toBe("RELAX");
  });

  it("classifies all 10 original RELAX audit queries as RELAX", () => {
    const queries = [
      "조용히 쉬다 올까?",
      "조용한 곳 가고 싶어",
      "오늘 좀 쉬고 싶어",
      "편하게 쉬다 올 곳",
      "잠깐 힐링하고 싶어",
      "차분하게 있을 곳",
      "복잡하지 않고 쉬기 좋은 곳",
      "조용히 시간 보내고 싶어",
      "편하게 머물다 올 곳",
      "가까운 곳에서 조용히 쉬고 싶어",
    ];
    for (const q of queries) {
      expect(roleOf(q)).toBe("RELAX");
    }
  });

  it("keeps Home RELAX shipped query as RELAX", () => {
    const q = getHomeSituationCandidate("relax")!.query;
    expect(q).toBe("조용히 시간 보낼 곳");
    expect(roleOf(q)).toBe("RELAX");
  });

  it("does not treat negative comfort/meal/date controls as RELAX", () => {
    expect(roleOf("편하게 밥 먹을 곳")).not.toBe("RELAX");
    expect(parseScenarioIntent("편하게 밥 먹을 곳").intentCategory).toBe("FOOD");
    expect(roleOf("편하게 주차할 수 있는 식당")).not.toBe("RELAX");
    expect(parseScenarioIntent("편하게 주차할 수 있는 식당").intentCategory).toBe("FOOD");
    expect(roleOf("편한 카페 의자")).not.toBe("RELAX");
    expect(parseScenarioIntent("편한 카페 의자").intentCategory).toBe("CAFE");
    expect(roleOf("데이트하기 편한 곳")).toBe("DATE");
    expect(roleOf("아이랑 편하게 먹을 곳")).not.toBe("RELAX");
    expect(parseScenarioIntent("아이랑 편하게 먹을 곳").intentCategory).toBe("FOOD");
  });
});
