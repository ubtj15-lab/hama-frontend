import { describe, expect, it } from "vitest";
import { presentRecommendation, readHttpCardBody } from "../recommendFetchStatus";

const place = (id: string) => ({ id, name: id });

describe("recommendation fetch status", () => {
  it("keeps a normal recommendation list in the same order", () => {
    const cards = [place("a"), place("b"), place("c")];
    const presented = presentRecommendation({
      primaryFailures: 0,
      primarySuccesses: 1,
      cards,
      suppression: "ok",
    });
    expect(presented).toEqual({ kind: "cards", cards });
    if (presented.kind === "cards") expect(presented.cards).toBe(cards);
  });

  it("treats a completed query with zero rows as an empty result", () => {
    expect(
      presentRecommendation({
        primaryFailures: 0,
        primarySuccesses: 1,
        cards: [],
        suppression: "ok",
      })
    ).toEqual({ kind: "empty" });
    expect(readHttpCardBody({ ok: true, body: { items: [] } })).toEqual({ status: "ok", cards: [] });
  });

  it("does not present a failed main query as an empty result", () => {
    expect(
      presentRecommendation({
        primaryFailures: 1,
        primarySuccesses: 0,
        cards: [],
        suppression: "ok",
      })
    ).toEqual({ kind: "fetch_failed" });
    expect(readHttpCardBody({ ok: false, body: { items: [], error: "supabase_select_failed" } })).toEqual({
      status: "failed",
    });
    expect(readHttpCardBody({ ok: false, body: null })).toEqual({ status: "failed" });
  });

  it("keeps successfully fetched cards when only an auxiliary query fails", () => {
    const cards = [place("kept")];
    expect(
      presentRecommendation({
        primaryFailures: 0,
        primarySuccesses: 1,
        cards,
        suppression: "ok",
      })
    ).toEqual({ kind: "cards", cards });
    expect(
      presentRecommendation({
        primaryFailures: 0,
        primarySuccesses: 1,
        cards: [],
        suppression: "ok",
      })
    ).toEqual({ kind: "empty" });
  });

  it("blocks every card when the suppression check fails", () => {
    const presented = presentRecommendation({
      primaryFailures: 0,
      primarySuccesses: 1,
      cards: [place("unverified")],
      suppression: "failed",
    });
    expect(presented).toEqual({ kind: "suppression_blocked" });
    expect(presented).not.toHaveProperty("cards");
  });

  it("reports a failed follow-up query instead of reusing it as an empty success", () => {
    const first = presentRecommendation({
      primaryFailures: 0,
      primarySuccesses: 1,
      cards: [place("play")],
      suppression: "ok",
    });
    const followUp = presentRecommendation({
      primaryFailures: 1,
      primarySuccesses: 0,
      cards: [],
      suppression: "ok",
    });
    expect(first.kind).toBe("cards");
    expect(followUp).toEqual({ kind: "fetch_failed" });
  });
});
