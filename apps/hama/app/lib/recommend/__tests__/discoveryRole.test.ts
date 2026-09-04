import { describe, expect, it } from "vitest";
import {
  applyDiscoveryRerank,
  classifyDiscoveryQuery,
  candidateDiscoveryAffinity,
  discoveryBandThreshold,
  type DiscoveryRerankItem,
} from "../discoveryRole";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";

function so(partial: Partial<ScenarioObject> & { rawQuery: string }): ScenarioObject {
  return {
    intentType: "scenario_recommendation",
    scenario: "generic",
    ...partial,
  };
}

function item(
  id: string,
  name: string,
  category: string,
  score: number,
  extra: Partial<DiscoveryRerankItem<{ id: string }>> = {}
): DiscoveryRerankItem<{ id: string }> {
  return { id, name, category, score, payload: { id }, ...extra };
}

describe("discovery classification", () => {
  it("does not treat explicit menu / cafe / meal queries as discovery", () => {
    expect(classifyDiscoveryQuery("냉면 땡겨", so({ rawQuery: "냉면 땡겨", menuIntent: ["냉면"] })).isDiscovery).toBe(
      false
    );
    expect(
      classifyDiscoveryQuery("카페 추천", so({ rawQuery: "카페 추천", queryUnderstanding: { rawQuery: "카페 추천", normalizedQuery: "카페 추천", strongVertical: true, route: "CAFE" } })).isDiscovery
    ).toBe(false);
    expect(classifyDiscoveryQuery("키즈카페 있는 곳", so({ rawQuery: "키즈카페 있는 곳", menuIntent: ["키즈카페"] })).isDiscovery).toBe(
      false
    );
    expect(classifyDiscoveryQuery("빵 맛있는 집", so({ rawQuery: "빵 맛있는 집" })).isDiscovery).toBe(false);
    expect(classifyDiscoveryQuery("많이 안 배부른 거", so({ rawQuery: "많이 안 배부른 거" })).isDiscovery).toBe(false);
  });

  it("classifies open / outdoor / date / family / relax without special-casing one query", () => {
    expect(classifyDiscoveryQuery("심심한데 뭐하지", so({ rawQuery: "심심한데 뭐하지" })).role).toBe("OPEN_DISCOVERY");
    expect(classifyDiscoveryQuery("오늘 뭐하지", so({ rawQuery: "오늘 뭐하지" })).isDiscovery).toBe(true);
    expect(classifyDiscoveryQuery("시간 남는데 뭐하지", so({ rawQuery: "시간 남는데 뭐하지" })).isDiscovery).toBe(true);
    expect(classifyDiscoveryQuery("날씨 좋은데 야외 나들이", so({ rawQuery: "날씨 좋은데 야외 나들이" })).role).toBe(
      "OUTDOOR"
    );
    expect(classifyDiscoveryQuery("데이트하기 좋은 곳", so({ rawQuery: "데이트하기 좋은 곳", scenario: "date" })).role).toBe(
      "DATE"
    );
    expect(classifyDiscoveryQuery("아이랑 갈 곳", so({ rawQuery: "아이랑 갈 곳", withKids: true })).role).toBe(
      "FAMILY_OUTING"
    );
    expect(classifyDiscoveryQuery("조용히 책 읽을 곳", so({ rawQuery: "조용히 책 읽을 곳" })).role).toBe("RELAX");
  });

  it("classifies rest/stay inflections as RELAX without bare 편하", () => {
    const positives = [
      "조용히 쉬다 올까?",
      "오늘 좀 쉬고 싶어",
      "편하게 쉬다 올 곳",
      "복잡하지 않고 쉬기 좋은 곳",
      "편하게 머물다 올 곳",
      "차분하게 있을 곳",
      "조용히 시간 보내고 싶어",
      "잠깐 힐링하고 싶어",
    ];
    for (const q of positives) {
      expect(classifyDiscoveryQuery(q, so({ rawQuery: q })).role).toBe("RELAX");
    }
  });

  it("does not treat comfort-word meal/date/cafe controls as RELAX", () => {
    expect(classifyDiscoveryQuery("편하게 밥 먹을 곳", so({ rawQuery: "편하게 밥 먹을 곳" })).role).not.toBe("RELAX");
    expect(classifyDiscoveryQuery("편하게 밥 먹을 곳", so({ rawQuery: "편하게 밥 먹을 곳" })).isDiscovery).toBe(
      false
    );
    expect(
      classifyDiscoveryQuery("편하게 주차할 수 있는 식당", so({ rawQuery: "편하게 주차할 수 있는 식당" })).role
    ).not.toBe("RELAX");
    expect(classifyDiscoveryQuery("편한 카페 의자", so({ rawQuery: "편한 카페 의자" })).role).not.toBe("RELAX");
    expect(classifyDiscoveryQuery("데이트하기 편한 곳", so({ rawQuery: "데이트하기 편한 곳" })).role).toBe("DATE");
    expect(classifyDiscoveryQuery("아이랑 편하게 먹을 곳", so({ rawQuery: "아이랑 편하게 먹을 곳" })).role).not.toBe(
      "RELAX"
    );
  });
});

describe("discovery rerank", () => {
  it("keeps a strong explicit-menu leader untouched", () => {
    const out = applyDiscoveryRerank(
      [
        item("naeng", "대궐막국수", "restaurant", 92),
        item("park", "느티근린공원", "activity", 80),
      ],
      "냉면 땡겨",
      so({ rawQuery: "냉면 땡겨", menuIntent: ["냉면"], intentType: "search_strict", intentCategory: "FOOD" }),
      { naturalDeckIds: ["naeng", "park"] }
    );
    expect(out.applied).toBe(false);
    expect(out.deck[0]?.id).toBe("naeng");
  });

  it("promotes a nearby park over a weak generic restaurant on outdoor discovery", () => {
    const out = applyDiscoveryRerank(
      [
        item("soup", "돌탄순댓국", "restaurant", 59),
        item("cafe", "데일리 오아시", "cafe", 48),
        item("park", "느티근린공원", "activity", 50),
      ],
      "날씨 좋은데 야외 나들이",
      so({ rawQuery: "날씨 좋은데 야외 나들이" }),
      { naturalDeckIds: ["soup", "cafe", "park"] }
    );
    expect(out.applied).toBe(true);
    expect(out.classification.role).toBe("OUTDOOR");
    expect(out.deck[0]?.id).toBe("park");
    expect(out.debug[0]?.reasons).toContain("DISCOVERY_ROLE_MATCH");
  });

  it("never promotes a far-below-band park over a high restaurant score", () => {
    const out = applyDiscoveryRerank(
      [
        item("best", "칼국수집", "restaurant", 92),
        item("park", "느티근린공원", "activity", 48),
        item("ok", "다른칼국수", "restaurant", 90),
      ],
      "칼국수 맛집",
      so({ rawQuery: "칼국수 맛집", menuIntent: ["칼국수"], intentType: "search_strict", intentCategory: "FOOD" }),
      { naturalDeckIds: ["best", "ok", "park"] }
    );
    expect(out.deck[0]?.id).toBe("best");
    expect(discoveryBandThreshold(92, false)).toBeLessThanOrEqual(16);
  });
});
