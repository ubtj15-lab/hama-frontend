import { describe, expect, it } from "vitest";
import { processConversationTurn } from "../processTurn";
import { mergeResultsScenario } from "../mergeResultsScenario";
import { composeAssistantReply } from "../assistantReply";
import type { ConversationContext } from "../types";

function chain(lines: string[], beforeEach?: (ctx: ConversationContext, line: string) => ConversationContext) {
  let ctx: ConversationContext | null = null;
  const steps: Array<{ line: string; ctx: ConversationContext }> = [];
  for (const line of lines) {
    if (ctx && beforeEach) ctx = beforeEach(ctx, line);
    ctx = processConversationTurn(line, ctx, { persist: false });
    steps.push({ line, ctx });
  }
  return steps;
}

describe("follow-up conversation quality", () => {
  const steps = chain(
    [
      "아이들과 갈 만한 실내 장소 찾아줘",
      "비 오는 날이라 야외 활동은 빼줘",
      "동탄으로 바꿔줘",
      "이동 거리는 더 가까운 곳으로 줄여줘",
      "키즈카페는 제외해줘",
      "방금 추천한 장소는 빼줘",
      "이번엔 조용한 카페로 바꿔줘",
    ],
    (ctx, line) => {
      if (line !== "방금 추천한 장소는 빼줘") return ctx;
      return {
        ...ctx,
        lastRecommendations: {
          placeIds: ["place-a", "place-b"],
          cards: [
            { id: "place-a", name: "동탄 키즈플레이", category: "activity" },
            { id: "place-b", name: "동탄 실내놀이터", category: "activity" },
          ],
        },
      };
    }
  );

  it("keeps kids, indoor, and rain when only the region changes", () => {
    const moved = mergeResultsScenario("동탄으로 바꿔줘", steps[2]!.ctx);
    expect(moved?.region).toBe("동탄");
    expect(moved?.withKids).toBe(true);
    expect(moved?.indoorPreferred).toBe(true);
    expect(moved?.weatherHint).toBe("rain");
    expect(moved?.intentCategory).not.toBe("CAFE");
  });

  it("keeps those conditions when the distance is shortened", () => {
    const nearer = mergeResultsScenario("이동 거리는 더 가까운 곳으로 줄여줘", steps[3]!.ctx);
    expect(nearer?.region).toBe("동탄");
    expect(nearer?.withKids).toBe(true);
    expect(nearer?.indoorPreferred).toBe(true);
    expect(nearer?.weatherHint).toBe("rain");
    expect(nearer?.distanceTolerance).toBe("near_only");
  });

  it("treats a kids-cafe exclusion as an exclusion, not a cafe request", () => {
    const excluded = mergeResultsScenario("키즈카페는 제외해줘", steps[4]!.ctx);
    expect(excluded?.intentCategory).not.toBe("CAFE");
    expect(excluded?.menuIntent ?? []).not.toContain("키즈카페");
    expect(excluded?.conversationExcludeMenuTerms ?? []).toEqual(expect.arrayContaining(["키즈카페", "놀이카페"]));
    expect(excluded?.withKids).toBe(true);
    expect(excluded?.region).toBe("동탄");
    expect(excluded?.indoorPreferred).toBe(true);
    const reply = composeAssistantReply({ intent: excluded!, placeNames: ["동탄 실내놀이터"] });
    expect(reply.text).not.toContain("키즈카페");
    expect(reply.text).toContain("동탄");
  });

  it("drops the places just shown without dropping the trip", () => {
    const dropped = steps[5]!.ctx;
    expect(dropped.rejectedPlaceIds).toEqual(["place-a", "place-b"]);
    const merged = mergeResultsScenario("방금 추천한 장소는 빼줘", dropped);
    expect(merged?.conversationExcludePlaceIds).toEqual(expect.arrayContaining(["place-a", "place-b"]));
    expect(merged?.region).toBe("동탄");
    expect(merged?.withKids).toBe(true);
    expect(merged?.indoorPreferred).toBe(true);
    expect(merged?.conversationExcludeMenuTerms ?? []).toEqual(expect.arrayContaining(["키즈카페"]));
  });

  it("starts a cafe search when the topic itself changes", () => {
    const cafe = mergeResultsScenario("이번엔 조용한 카페로 바꿔줘", steps[6]!.ctx);
    expect(cafe?.intentCategory).toBe("CAFE");
    expect(cafe?.region).toBe("동탄");
    expect(cafe?.vibePreference ?? []).toContain("calm");
  });
});
