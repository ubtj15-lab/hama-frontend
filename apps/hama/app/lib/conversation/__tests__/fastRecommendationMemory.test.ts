import { describe, expect, it } from "vitest";
import { processConversationTurn } from "../processTurn";
import { canWriteRecommendationsForQuery } from "../storage";
import type { ConversationContext } from "../types";

function shown(ctx: ConversationContext, placeIds: string[], query: string): ConversationContext {
  return { ...ctx, lastRecommendations: { placeIds, query } };
}

describe("fast consecutive recommendation memory", () => {
  it("excludes the list shown immediately before each reject and ignores a stale write", () => {
    const first = "동탄에서 아이들이랑 놀 곳 찾아줘.";
    const indoor = "비 오는 날 실내로 추천해 줘.";
    const again = "이거 말고";
    const other = "이거 말고 다른 곳";

    let ctx = processConversationTurn(first, null, { persist: false });
    ctx = shown(ctx, ["water"], first);
    ctx = processConversationTurn(indoor, ctx, { persist: false });
    expect(ctx.currentIntent.region).toBe("동탄");
    expect(ctx.currentIntent.indoorPreferred).toBe(true);
    expect(ctx.rejectedPlaceIds).toBeUndefined();

    ctx = shown(ctx, ["hero", "champion"], indoor);
    ctx = processConversationTurn(again, ctx, { persist: false });
    expect(ctx.rejectedPlaceIds).toEqual(["hero", "champion"]);
    expect(canWriteRecommendationsForQuery(ctx, indoor)).toBe(false);
    expect(canWriteRecommendationsForQuery(ctx, again)).toBe(true);

    ctx = shown(ctx, ["kids-cafe"], again);
    ctx = processConversationTurn(other, ctx, { persist: false });
    expect(ctx.rejectedPlaceIds).toEqual(["hero", "champion", "kids-cafe"]);
    expect(ctx.currentIntent.region).toBe("동탄");
    expect(ctx.currentIntent.indoorPreferred).toBe(true);
    expect(canWriteRecommendationsForQuery(ctx, again)).toBe(false);
  });
});
