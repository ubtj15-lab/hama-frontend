import { beforeEach, describe, expect, it } from "vitest";
import { HamaEvents } from "../events";
import { isAllowedProductLogType } from "@/lib/server/activityEventGuard";
import {
  claimConversationTurnOutcome,
  resetConversationTurnOutcomeClaims,
  resolveConversationTurnOutcome,
} from "../conversationTurnOutcome";

describe("conversation turn outcome", () => {
  beforeEach(() => {
    resetConversationTurnOutcomeClaims();
  });

  it("is on the server product log allowlist", () => {
    expect(HamaEvents.conversation_turn_outcome).toBe("conversation_turn_outcome");
    expect(isAllowedProductLogType("conversation_turn_outcome")).toBe(true);
  });

  it("records shown when verified cards are on screen, including a partial failure", () => {
    expect(
      resolveConversationTurnOutcome({
        pending: false,
        shownCardCount: 2,
        suppressionFailed: false,
        fetchFailed: false,
      })
    ).toBe("shown");
    expect(
      resolveConversationTurnOutcome({
        pending: false,
        shownCardCount: 1,
        suppressionFailed: true,
        fetchFailed: true,
      })
    ).toBe("shown");
  });

  it("records empty only after a finished search with nothing to show", () => {
    expect(
      resolveConversationTurnOutcome({
        pending: false,
        shownCardCount: 0,
        suppressionFailed: false,
        fetchFailed: false,
      })
    ).toBe("empty");
  });

  it("records fetch and suppression failures only when no card is shown", () => {
    expect(
      resolveConversationTurnOutcome({
        pending: false,
        shownCardCount: 0,
        suppressionFailed: false,
        fetchFailed: true,
      })
    ).toBe("fetch_failed");
    expect(
      resolveConversationTurnOutcome({
        pending: false,
        shownCardCount: 0,
        suppressionFailed: true,
        fetchFailed: true,
      })
    ).toBe("suppression_failed");
  });

  it("does not record a search that is still running or waiting for clarification", () => {
    expect(
      resolveConversationTurnOutcome({
        pending: true,
        shownCardCount: 0,
        suppressionFailed: false,
        fetchFailed: false,
      })
    ).toBeNull();
    expect(
      resolveConversationTurnOutcome({
        pending: true,
        shownCardCount: 2,
        suppressionFailed: false,
        fetchFailed: false,
      })
    ).toBeNull();
  });

  it("records one outcome per turn across rerenders", () => {
    expect(claimConversationTurnOutcome("turn-1")).toBe(true);
    expect(claimConversationTurnOutcome("turn-1")).toBe(false);
    expect(claimConversationTurnOutcome("turn-2")).toBe(true);
  });
});
