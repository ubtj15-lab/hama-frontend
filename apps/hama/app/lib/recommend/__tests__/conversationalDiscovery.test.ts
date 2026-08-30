import { describe, expect, it } from "vitest";
import { detectConversationalDiscovery } from "../conversationalDiscovery";
import { classifyDiscoveryQuery } from "../discoveryRole";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";

function so(partial: Partial<ScenarioObject> & { rawQuery: string }): ScenarioObject {
  return {
    intentType: "scenario_recommendation",
    scenario: "generic",
    ...partial,
  };
}

describe("conversational discovery signals", () => {
  it("detects spare time / open decision / go-out / boredom with intervening particles", () => {
    const spare = detectConversationalDiscovery("시간 좀 남았어", so({ rawQuery: "시간 좀 남았어" }));
    expect(spare.detected).toBe(true);
    expect(spare.semanticClass).toBe("SPARE_TIME");
    expect(classifyDiscoveryQuery("시간 좀 남았어", so({ rawQuery: "시간 좀 남았어" })).isDiscovery).toBe(true);

    const open = detectConversationalDiscovery("어디 좀 갈까", so({ rawQuery: "어디 좀 갈까" }));
    expect(open.detected).toBe(true);
    expect(open.semanticClass).toBe("OPEN_DECISION");

    const go = detectConversationalDiscovery("잠깐 나갈까", so({ rawQuery: "잠깐 나갈까" }));
    expect(go.detected).toBe(true);
    expect(go.semanticClass).toBe("GO_OUT");

    const bored = detectConversationalDiscovery("뭐 할 거 없나", so({ rawQuery: "뭐 할 거 없나" }));
    expect(bored.detected).toBe(true);

    const scene = detectConversationalDiscovery("오늘 좀 답답한데", so({ rawQuery: "오늘 좀 답답한데" }));
    expect(scene.detected).toBe(true);
    expect(scene.semanticClass).toBe("CHANGE_OF_SCENE");

    const exist = detectConversationalDiscovery("괜찮은 데 없어?", so({ rawQuery: "괜찮은 데 없어?" }));
    expect(exist.detected).toBe(true);
    expect(exist.semanticClass).toBe("OPEN_DECISION");
  });

  it("does not override specific food / cafe / menu / venue intents", () => {
    expect(detectConversationalDiscovery("오늘 뭐 먹지", so({ rawQuery: "오늘 뭐 먹지" })).detected).toBe(false);
    expect(detectConversationalDiscovery("커피 마실까", so({ rawQuery: "커피 마실까" })).blockReason).toBe("explicit_cafe");
    expect(
      detectConversationalDiscovery(
        "한우 어디서 먹을까",
        so({ rawQuery: "한우 어디서 먹을까", menuIntent: ["한우"] })
      ).blockReason
    ).toBe("menuIntent");
    expect(detectConversationalDiscovery("아이랑 키즈카페 갈까", so({ rawQuery: "아이랑 키즈카페 갈까" })).detected).toBe(
      false
    );
    expect(detectConversationalDiscovery("브런치 먹을까", so({ rawQuery: "브런치 먹을까" })).detected).toBe(false);
    expect(detectConversationalDiscovery("돈가스 괜찮은 데", so({ rawQuery: "돈가스 괜찮은 데" })).detected).toBe(false);
  });

  it("keeps existing v1 discovery queries", () => {
    expect(classifyDiscoveryQuery("심심한데 뭐하지", so({ rawQuery: "심심한데 뭐하지" })).isDiscovery).toBe(true);
    expect(classifyDiscoveryQuery("오늘 뭐하지", so({ rawQuery: "오늘 뭐하지" })).isDiscovery).toBe(true);
    expect(classifyDiscoveryQuery("아이랑 갈 곳", so({ rawQuery: "아이랑 갈 곳", withKids: true })).role).toBe(
      "FAMILY_OUTING"
    );
  });

  it("maps short conversational classes onto existing discovery roles", () => {
    expect(classifyDiscoveryQuery("시간 좀 남았어", so({ rawQuery: "시간 좀 남았어" })).role).toBe("OPEN_DISCOVERY");
    expect(classifyDiscoveryQuery("잠깐 나갈까", so({ rawQuery: "잠깐 나갈까" })).role).toBe("OPEN_DISCOVERY");
    expect(classifyDiscoveryQuery("애들이 심심해해", so({ rawQuery: "애들이 심심해해", withKids: true })).role).toBe(
      "FAMILY_OUTING"
    );
    expect(
      classifyDiscoveryQuery("둘이 시간 좀 남았는데", so({ rawQuery: "둘이 시간 좀 남았는데", scenario: "date" })).role
    ).toBe("DATE");
    expect(classifyDiscoveryQuery("비 오는데 뭐하지", so({ rawQuery: "비 오는데 뭐하지" })).role).toBe("INDOOR");
  });

  it("keeps catalog/menu/venue queries on their specific intent", () => {
    const parsed = parseScenarioIntent("곱창 먹을까");
    expect(classifyDiscoveryQuery("곱창 먹을까", parsed).isDiscovery).toBe(false);
    expect(detectConversationalDiscovery("오늘 영화 볼까", so({ rawQuery: "오늘 영화 볼까" })).detected).toBe(false);
    expect(detectConversationalDiscovery("산책할 공원", so({ rawQuery: "산책할 공원" })).detected).toBe(false);
    expect(detectConversationalDiscovery("데이트할 카페", so({ rawQuery: "데이트할 카페" })).detected).toBe(false);
  });

  it("does not revive excluded cafe/restaurant on remainder discovery", () => {
    const cafe = parseScenarioIntent("카페 말고 어디 갈까");
    expect(cafe.queryUnderstanding?.negation?.excludedCategories).toContain("cafe");
    const cafeDisc = classifyDiscoveryQuery("카페 말고 어디 갈까", cafe);
    expect(cafeDisc.isDiscovery).toBe(true);
    expect(cafeDisc.conversational?.detected).toBe(true);

    const rest = parseScenarioIntent("식당 말고 뭐 할 거 없나");
    expect(rest.queryUnderstanding?.negation?.excludedCategories).toContain("restaurant");
    expect(classifyDiscoveryQuery("식당 말고 뭐 할 거 없나", rest).isDiscovery).toBe(true);
  });

  it("generalizes stem+particle variation without a phrase list", () => {
    expect(detectConversationalDiscovery("뭐하면좋지", so({ rawQuery: "뭐하면좋지" })).detected).toBe(true);
    expect(detectConversationalDiscovery("어디라도 갈까", so({ rawQuery: "어디라도 갈까" })).detected).toBe(true);
    expect(detectConversationalDiscovery("한 시간 비었어", so({ rawQuery: "한 시간 비었어" })).semanticClass).toBe(
      "SPARE_TIME"
    );
    expect(detectConversationalDiscovery("갈 만한 데 없나", so({ rawQuery: "갈 만한 데 없나" })).detected).toBe(true);
    expect(detectConversationalDiscovery("자투리시간이 생겼는데", so({ rawQuery: "자투리시간이 생겼는데" })).semanticClass).toBe(
      "SPARE_TIME"
    );
    expect(detectConversationalDiscovery("문밖으로 나서볼까", so({ rawQuery: "문밖으로 나서볼까" })).semanticClass).toBe(
      "GO_OUT"
    );
    expect(detectConversationalDiscovery("무료해서 할거리없을까", so({ rawQuery: "무료해서 할거리없을까" })).semanticClass).toBe(
      "BOREDOM"
    );
    expect(
      detectConversationalDiscovery("갑갑해서 환기하고싶어", so({ rawQuery: "갑갑해서 환기하고싶어" })).semanticClass
    ).toBe("CHANGE_OF_SCENE");
    expect(detectConversationalDiscovery("어느쪽으로 가볼까", so({ rawQuery: "어느쪽으로 가볼까" })).detected).toBe(true);
  });

  it("treats generic 놀거리/할거리 activity-strict as boredom discovery, not a venue", () => {
    const playSeek = parseScenarioIntent("요즘 무료해서 놀거리없을까");
    expect(classifyDiscoveryQuery("요즘 무료해서 놀거리없을까", playSeek).isDiscovery).toBe(true);
    const choreSeek = parseScenarioIntent("오후에 따분해서 할거리없을까");
    expect(classifyDiscoveryQuery("오후에 따분해서 할거리없을까", choreSeek).isDiscovery).toBe(true);
    const venue = classifyDiscoveryQuery("방탈출 난이도 쉬운", parseScenarioIntent("방탈출 난이도 쉬운"));
    expect(venue.conversational?.detected).toBe(false);
    expect(venue.conversational?.blockReason).toBe("explicit_venue");
  });

  it("does not treat 많이 안 배부른 거 as discovery", () => {
    expect(classifyDiscoveryQuery("많이 안 배부른 거", so({ rawQuery: "많이 안 배부른 거" })).isDiscovery).toBe(false);
  });

  it("blocks catalog-style menu queries that contain discovery-like particles", () => {
    const parsed = parseScenarioIntent("한우 어디서 먹을까");
    const disc = classifyDiscoveryQuery("한우 어디서 먹을까", parsed);
    expect(disc.isDiscovery).toBe(false);
    expect(
      disc.conversational?.blockedBySpecificIntent ||
        disc.reasons.includes("explicit_menu") ||
        disc.reasons.includes("explicit_meal") ||
        disc.reasons.includes("search_strict")
    ).toBe(true);
  });
});
