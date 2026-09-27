import { describe, expect, it } from "vitest";
import { processConversationTurn } from "../processTurn";
import { detectRefinementType } from "../refinement";
import { mergeResultsScenario } from "../mergeResultsScenario";
import { composeAssistantReply, withAssistantReply } from "../assistantReply";
import { buildLinkedFoodScenario, playListStabilityKey, resolveFoodAnchor, shouldKeepShownPlayList } from "../linkedPurpose";
import { filterCardsByNamedRegion, regionClarificationFor } from "../namedRegion";
import type { ConversationContext } from "../types";

const LINES = [
  "동탄에서 아이들이랑 놀 곳 찾아줘.",
  "비 오니까 실내로 추천해 줘.",
  "이거 말고 다른 데는?",
  "근처에서 밥 먹을 곳도 알려줘.",
] as const;

function chain(lines: readonly string[], beforeEach?: (ctx: ConversationContext, line: string) => ConversationContext) {
  let ctx: ConversationContext | null = null;
  const snapshots: Array<{ line: string; ctx: ConversationContext; merged: ReturnType<typeof mergeResultsScenario> }> = [];
  for (const line of lines) {
    if (ctx && beforeEach) ctx = beforeEach(ctx, line);
    ctx = processConversationTurn(line, ctx, { persist: false });
    snapshots.push({ line, ctx, merged: mergeResultsScenario(line, ctx) });
  }
  return snapshots;
}

describe("rule conversation prototype", () => {
  const turns = chain(LINES, (ctx, line) => {
    if (line !== LINES[2]) return ctx;
    return { ...ctx, lastRecommendations: { placeIds: ["shown-1", "shown-2"] } };
  });

  it("keeps kids while adding indoor and rain", () => {
    const first = turns[0]!;
    const second = turns[1]!;
    expect(detectRefinementType(LINES[0], null)).toBe("new_request");
    expect(first.merged?.withKids).toBe(true);
    expect(first.merged?.intentCategory).toBe("ACTIVITY");
    expect(first.merged?.region).toBe("동탄");
    expect(detectRefinementType(LINES[1], first.ctx)).toBe("refine");
    expect(second.merged?.withKids).toBe(true);
    expect(second.merged?.indoorPreferred).toBe(true);
    expect(second.merged?.weatherHint).toBe("rain");
    expect(second.merged?.intentCategory).toBe("ACTIVITY");
    expect(second.merged?.region).toBe("동탄");
  });

  it("excludes the shown places without dropping kids or indoor", () => {
    const third = turns[2]!;
    expect(detectRefinementType(LINES[2], turns[1]!.ctx)).toBe("reject");
    expect(third.ctx.rejectedPlaceIds).toEqual(["shown-1", "shown-2"]);
    expect(third.merged?.withKids).toBe(true);
    expect(third.merged?.indoorPreferred).toBe(true);
    expect(third.merged?.weatherHint).toBe("rain");
    expect(third.merged?.region).toBe("동탄");
    expect(third.merged?.conversationExcludePlaceIds).toEqual(expect.arrayContaining(["shown-1", "shown-2"]));
    expect(third.ctx.clarificationNeeded).toBeUndefined();
  });

  it("adds nearby food while keeping the earlier conditions", () => {
    const fourth = turns[3]!;
    expect(detectRefinementType(LINES[3], turns[2]!.ctx)).toBe("narrow");
    expect(fourth.merged?.intentCategory).toBe("ACTIVITY");
    expect(fourth.merged?.region).toBe("동탄");
    expect(fourth.merged?.withKids).toBe(true);
    expect(fourth.merged?.indoorPreferred).toBe(true);
    expect(fourth.merged?.weatherHint).toBe("rain");
    expect(fourth.ctx.linkedPurposes?.[0]?.intentCategory).toBe("FOOD");
    expect(fourth.merged?.distanceTolerance).toBeUndefined();
    expect(fourth.merged?.conversationExcludePlaceIds).toEqual(expect.arrayContaining(["shown-1", "shown-2"]));
    const food = buildLinkedFoodScenario(fourth.merged!, true);
    expect(food.intentCategory).toBe("FOOD");
    expect(food.distanceTolerance).toBe("near_only");
    expect(food.conversationExcludePlaceIds).toBeUndefined();
  });

  it("asks back and does not name stores when the turn is unclear", () => {
    const prev = processConversationTurn("애들", null, { persist: false });
    const vague = "뭐가 좋아?";
    expect(detectRefinementType(vague, prev)).toBe("clarify");
    const ctx = processConversationTurn(vague, prev, { persist: false });
    expect(ctx.clarificationNeeded).toBe(true);
    const reply = composeAssistantReply({
      clarificationNeeded: true,
      intent: ctx.currentIntent,
      placeNames: ["보여주면 안 되는 매장"],
    });
    expect(reply.suppressRecommendations).toBe(true);
    expect(reply.text).not.toContain("보여주면 안 되는 매장");
  });

  it("names only the recommended cards, in order", () => {
    const reply = composeAssistantReply({
      intent: turns[1]!.merged!,
      placeNames: ["첫째", "둘째", "셋째"],
    });
    expect(reply.suppressRecommendations).toBe(false);
    expect(reply.text).toContain("동탄");
    expect(reply.text).toContain("아이 동반");
    expect(reply.text).toContain("실내");
    expect(reply.text).toContain("비 오는 날");
    expect(reply.text.indexOf("첫째")).toBeLessThan(reply.text.indexOf("둘째"));
    expect(reply.text.indexOf("둘째")).toBeLessThan(reply.text.indexOf("셋째"));
    const saved = withAssistantReply(turns[1]!.ctx, reply.text);
    expect(saved.turns.map((turn) => turn.role)).toEqual(["user", "user", "assistant"]);
    expect(withAssistantReply(saved, reply.text)).toBe(saved);
  });

  it("keeps engine order while dropping places outside the named region", () => {
    const shown = filterCardsByNamedRegion(
      [
        { name: "오산키즈", area: "오산", address: "오산시" },
        { name: "동탄키즈카페", area: "동탄", address: "화성시 동탄" },
        { name: "동탄식당", area: null, address: "동탄대로" },
      ],
      "동탄"
    );
    expect(shown.map((card) => card.name)).toEqual(["동탄키즈카페", "동탄식당"]);
  });

  it("builds a food scenario without changing the play scenario", () => {
    const play = turns[3]!.merged!;
    const food = buildLinkedFoodScenario(play);
    expect(play.intentCategory).toBe("ACTIVITY");
    expect(play.indoorPreferred).toBe(true);
    expect(food.intentCategory).toBe("FOOD");
    expect(food.indoorPreferred).toBe(false);
    expect(food.region).toBe("동탄");
    expect(food.withKids).toBe(true);
    expect(food.indoorPreferred).toBe(false);
    const playWithRejects = { ...play, conversationExcludePlaceIds: ["play-1"] };
    const isolated = buildLinkedFoodScenario(playWithRejects);
    expect(playWithRejects.conversationExcludePlaceIds).toEqual(["play-1"]);
    expect(isolated.conversationExcludePlaceIds).toBeUndefined();
    const anchor = resolveFoodAnchor(
      [
        { id: "a", lat: 37.1, lng: 127.1 },
        { id: "b", lat: 37.2, lng: 127.2 },
      ],
      null
    );
    expect(anchor.provisional).toBe(true);
    expect(anchor.card?.id).toBe("a");
  });

  it("keeps displayed play ids and order when only a meal is added", () => {
    const play = [
      { id: "play-a", name: "놀이A", category: "activity" as const, lat: 37.2, lng: 127.07 },
      { id: "play-b", name: "놀이B", category: "activity" as const, lat: 37.21, lng: 127.08 },
      { id: "play-c", name: "놀이C", category: "activity" as const, lat: 37.22, lng: 127.09 },
    ];
    const prior = chain(["동탄에서 아이들이랑 놀 곳 찾아줘.", "비 오니까 실내로 추천해 줘."]);
    const indoor = {
      ...prior[1]!.ctx,
      lastRecommendations: {
        placeIds: play.map((card) => card.id),
        query: "비 오니까 실내로 추천해 줘.",
        cards: play,
      },
    };
    const mealLine = "근처 식당도 찾아줘";
    const meal = processConversationTurn(mealLine, indoor, { persist: false });
    expect(meal.frozenPlayCards?.map((card) => card.id)).toEqual(["play-a", "play-b", "play-c"]);
    expect(meal.currentIntent.intentCategory).toBe("ACTIVITY");
    expect(meal.currentIntent.distanceTolerance).toBeUndefined();
    const merged = mergeResultsScenario(mealLine, meal);
    expect(merged?.region).toBe("동탄");
    expect(merged?.indoorPreferred).toBe(true);
    expect(shouldKeepShownPlayList(true, playListStabilityKey(prior[1]!.merged), playListStabilityKey(merged))).toBe(true);
    const chosen = resolveFoodAnchor(play, "play-b");
    expect(chosen.card?.id).toBe("play-b");
    expect(chosen.provisional).toBe(false);
    const temporary = resolveFoodAnchor(play, null);
    expect(temporary.card?.id).toBe("play-a");
    expect(temporary.provisional).toBe(true);
    const osanLine = "이번에는 오산에서 놀 곳 찾아줘";
    const osan = processConversationTurn(osanLine, meal, { persist: false });
    expect(osan.frozenPlayCards).toBeUndefined();
    expect(mergeResultsScenario(osanLine, osan)?.region).toBe("오산");
    expect(
      shouldKeepShownPlayList(false, playListStabilityKey(merged), playListStabilityKey(mergeResultsScenario(osanLine, osan)))
    ).toBe(false);
    const corrupt = processConversationTurn(
      mealLine,
      {
        ...indoor,
        lastRecommendations: { cards: [{ id: "", name: "깨진 카드", category: "activity" }] },
        frozenPlayCards: [
          { id: "dup", name: "하나", category: "activity" },
          { id: "dup", name: "둘", category: "activity" },
        ],
      },
      { persist: false }
    );
    expect(corrupt.frozenPlayCards).toBeUndefined();
  });

  it("drops area-tag-only stores and does not backfill other cities", () => {
    const cards = [
      { name: "벌툰 파리지앵 병점점", address: "경기 화성시 효행로 1051" },
      { name: "히어로플레이파크 동탄역점", address: "경기 화성시 동탄대로 1" },
      { name: "오산키즈", address: "경기 오산시 성호대로 1" },
    ];
    expect(filterCardsByNamedRegion(cards, "동탄").map((card) => card.name)).toEqual([
      "히어로플레이파크 동탄역점",
    ]);
    expect(
      filterCardsByNamedRegion(
        [{ name: "무슨점 동탄점", address: "경기 오산시 성호대로 1" }],
        "동탄"
      )
    ).toEqual([]);
    expect(
      filterCardsByNamedRegion(
        [{ name: "반송돈 동탄북광장점", address: "반송돈 동탄북광장점" }],
        "동탄"
      )
    ).toEqual([]);
    expect(filterCardsByNamedRegion(cards, "평택")).toEqual([]);
    expect(filterCardsByNamedRegion(cards, "오산").map((card) => card.name)).toEqual(["오산키즈"]);
    expect(
      filterCardsByNamedRegion(
        [
          { name: "쭈돼집", address: "경기 화성시 동탄오산로 86" },
          { name: "샛강공원", address: "경기 화성시 오산동 967" },
        ],
        "오산"
      )
    ).toEqual([]);
  });

  it("keeps 동탄 through follow-ups and replaces it when 오산 is named", () => {
    const steps = chain([
      "동탄에서 아이들이랑 놀 곳 찾아줘.",
      "비 오니까 실내로 추천해 줘.",
      "이거 말고 다른 데는?",
      "이번에는 오산에서 찾아줘.",
    ]);
    expect(steps[0]!.merged?.region).toBe("동탄");
    expect(steps[1]!.merged?.region).toBe("동탄");
    expect(steps[1]!.merged?.intentType).toBe("search_strict");
    expect(steps[1]!.merged?.indoorPreferred).toBe(true);
    expect(steps[2]!.merged?.region).toBe("동탄");
    expect(steps[2]!.ctx.rejectedPlaceIds).toBeUndefined();
    expect(steps[3]!.merged?.region).toBe("오산");
    expect(steps[3]!.merged?.withKids).toBe(true);
    expect(steps[3]!.merged?.indoorPreferred).toBe(true);
    expect(detectRefinementType("이번에는 오산에서 찾아줘.", steps[2]!.ctx)).toBe("refine");
  });

  it("asks instead of guessing 화성", () => {
    const ctx = chain(["동탄에서 아이들이랑 놀 곳 찾아줘.", "화성에서 찾아줘"]);
    expect(regionClarificationFor("화성에서 찾아줘")).toContain("동탄");
    expect(ctx[1]!.ctx.clarificationNeeded).toBe(true);
    expect(ctx[1]!.ctx.currentIntent.region).toBe("동탄");
  });
});
