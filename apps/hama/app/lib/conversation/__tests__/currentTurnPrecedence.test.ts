import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { processConversationTurn } from "../processTurn";
import { detectRefinementType } from "../refinement";
import { mergeResultsScenario } from "../mergeResultsScenario";
import { classifyDiscoveryQuery } from "@/lib/recommend/discoveryRole";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { runConversationScenarioChecks } from "../conversation.scenarios";
import { resolveSearchQueryForHomeCards } from "@/lib/results/resultsQueryRouting";

function chain(lines: string[]) {
  let ctx = null as ReturnType<typeof processConversationTurn> | null;
  for (const line of lines) {
    ctx = processConversationTurn(line, ctx, { persist: false });
  }
  return ctx!;
}

describe("current-turn precedence", () => {
  it("date → kids indoor-play is a new self-contained PLAY turn", () => {
    const t1 = "데이트";
    const t2 = "아이들이랑 실내에서 놀 만한 데 없어?";
    const prev = processConversationTurn(t1, null, { persist: false });
    expect(detectRefinementType(t2, prev)).toBe("new_request");
    const ctx = processConversationTurn(t2, prev, { persist: false });
    const merged = mergeResultsScenario(t2, ctx);
    expect(merged?.scenario).not.toBe("date");
    expect(merged?.withKids).toBe(true);
    expect(merged?.indoorPreferred).toBe(true);
    expect(merged?.queryUnderstanding?.purposeIntents ?? []).toContain("indoor_play");
    expect(classifyDiscoveryQuery(t2, merged!).role).toBe("PLAY");
  });

  it("kids outing → explicit date does not inherit withKids", () => {
    const t1 = "아이들이랑 놀러 갈 곳 추천해줘";
    const t2 = "와이프랑 둘이 데이트할 곳 추천해줘";
    const prev = processConversationTurn(t1, null, { persist: false });
    expect(detectRefinementType(t2, prev)).toBe("new_request");
    const ctx = processConversationTurn(t2, prev, { persist: false });
    const merged = mergeResultsScenario(t2, ctx);
    expect(merged?.scenario).toBe("date");
    expect(merged?.withKids).not.toBe(true);
    expect(classifyDiscoveryQuery(t2, merged!).role).toBe("DATE");
  });

  it("cafe → kids food is FOOD", () => {
    const t1 = "카페 추천해줘";
    const t2 = "아이들이랑 맛있는 거 먹으러 가고 싶어";
    const prev = processConversationTurn(t1, null, { persist: false });
    expect(detectRefinementType(t2, prev)).toBe("new_request");
    const ctx = processConversationTurn(t2, prev, { persist: false });
    const merged = mergeResultsScenario(t2, ctx);
    expect(merged?.intentCategory).toBe("FOOD");
    expect(classifyDiscoveryQuery(t2, merged!).isDiscovery).toBe(false);
  });

  it("kids → 실내로 inherits withKids and adds indoor", () => {
    const ctx = chain(["아이들이랑 갈 만한 데 추천해줘", "실내로"]);
    expect(detectRefinementType("실내로", processConversationTurn("아이들이랑 갈 만한 데 추천해줘", null, { persist: false }))).not.toBe(
      "new_request"
    );
    const merged = mergeResultsScenario("실내로", ctx);
    expect(merged?.withKids).toBe(true);
    expect(merged?.indoorPreferred).toBe(true);
  });

  it("date → 조용한 곳으로 keeps date and adds calm", () => {
    const t1 = "와이프랑 데이트할 곳";
    const prev = processConversationTurn(t1, null, { persist: false });
    expect(detectRefinementType("조용한 곳으로", prev)).not.toBe("new_request");
    const ctx = processConversationTurn("조용한 곳으로", prev, { persist: false });
    const merged = mergeResultsScenario("조용한 곳으로", ctx);
    expect(merged?.scenario).toBe("date");
    expect(merged?.vibePreference ?? ctx.currentIntent.vibePreference).toEqual(
      expect.arrayContaining(["calm"])
    );
  });

  it("food → 고기 말고 keeps FOOD and exclusion", () => {
    const t1 = "오늘 뭐 먹지?";
    const prev = processConversationTurn(t1, null, { persist: false });
    expect(detectRefinementType("고기 말고", prev)).toBe("reject");
    const ctx = processConversationTurn("고기 말고", prev, { persist: false });
    const merged = mergeResultsScenario("고기 말고", ctx);
    expect(merged?.intentCategory).toBe("FOOD");
  });

  it("cafe → 가까운 데 keeps CAFE and near", () => {
    const t1 = "카페 추천해줘";
    const prev = processConversationTurn(t1, null, { persist: false });
    expect(detectRefinementType("가까운 데", prev)).toBe("narrow");
    const ctx = processConversationTurn("가까운 데", prev, { persist: false });
    const merged = mergeResultsScenario("가까운 데", ctx);
    expect(merged?.intentCategory).toBe("CAFE");
    expect(merged?.distanceTolerance ?? ctx.currentIntent.distanceTolerance).toBe("near_only");
  });

  it("osan quiet cafe after a kids meal is a new cafe search", () => {
    const first = "동탄에서 아이들이랑 갈 만한 곳 찾아줘";
    const meal = "그 근처에 밥 먹을 곳도 있어?";
    const cafe = "오산에서 조용한 카페";
    const started = processConversationTurn(first, null, { persist: false, turnId: "t1" });
    const withMeal = processConversationTurn(meal, started, { persist: false, turnId: "t2" });
    expect(withMeal.currentIntent.withKids).toBe(true);
    expect(withMeal.currentIntent.region).toBe("동탄");
    expect(withMeal.linkedPurposes?.some((item) => item.intentCategory === "FOOD")).toBe(true);
    expect(detectRefinementType(cafe, withMeal)).toBe("new_request");
    const next = processConversationTurn(cafe, withMeal, { persist: false, turnId: "t3" });
    const merged = mergeResultsScenario(cafe, next);
    expect(next.currentIntent.intentCategory).toBe("CAFE");
    expect(next.currentIntent.region).toBe("오산");
    expect(next.currentIntent.withKids).not.toBe(true);
    expect(next.currentIntent.scenario).not.toBe("family_kids");
    expect(next.linkedPurposes).toBeUndefined();
    expect(merged?.withKids).not.toBe(true);
    expect(merged?.intentCategory).toBe("CAFE");
    expect(merged?.region).toBe("오산");
    expect(merged?.foodPreference ?? []).not.toContain("kid_friendly_menu");
    expect(next.turns.filter((turn) => turn.role === "user").map((turn) => turn.text)).toEqual([first, meal, cafe]);
  });
});

describe("clean current-turn controls", () => {
  it("indoor-play / family / food without history", () => {
    const play = parseScenarioIntent("아이들이랑 실내에서 놀 만한 데 없어?");
    expect(classifyDiscoveryQuery("아이들이랑 실내에서 놀 만한 데 없어?", play).role).toBe("PLAY");
    const family = parseScenarioIntent("오늘 애들이랑 어디 가지?");
    expect(classifyDiscoveryQuery("오늘 애들이랑 어디 가지?", family).role).toBe("FAMILY_OUTING");
    const food = parseScenarioIntent("아이들이랑 맛있는 거 먹으러 가고 싶어");
    expect(food.intentCategory).toBe("FOOD");
    expect(classifyDiscoveryQuery("아이들이랑 맛있는 거 먹으러 가고 싶어", food).isDiscovery).toBe(false);
  });
});

describe("existing dependent conversation scenarios", () => {
  it("keeps lunch+kids / course+indoor / cafe+near chains", () => {
    const failures = runConversationScenarioChecks();
    expect(failures).toEqual([]);
  });
});

describe("Results semantic query is current turn", () => {
  it("does not use cumulativeText as the default searchQuery", () => {
    const screen = readFileSync(resolve(__dirname, "../../../results/ResultsScreen.tsx"), "utf8");
    const page = readFileSync(resolve(__dirname, "../../../results/page.tsx"), "utf8");
    const routing = readFileSync(resolve(__dirname, "../../results/resultsQueryRouting.ts"), "utf8");
    expect(screen).not.toMatch(/convCtx\?\.cumulativeText\s*\?\?\s*qRaw/);
    expect(page).not.toMatch(/convCtx\?\.cumulativeText\s*\?\?\s*qRaw/);
    expect(screen).toContain("resolveSearchQueryForHomeCards");
    expect(page).toContain("resolveSearchQueryForHomeCards");
    expect(routing).toMatch(/return qRaw \|\| null/);
    expect(
      resolveSearchQueryForHomeCards({
        qRaw: "조용한 식당",
        explicitCategory: null,
        isSoloSituationQuery: false,
        hasNamedFoodPreset: false,
      })
    ).toBe("조용한 식당");
  });
});
