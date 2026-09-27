import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { presentRecommendation, type CardFetch } from "@/lib/recommend/recommendFetchStatus";
import { fetchDirectSearchHomeCards, isDirectSearchModeQuery } from "@/lib/search/directSearch";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

function placeRow(id: string) {
  return { id, name: id, category: "restaurant" };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("direct search fetch status", () => {
  it("returns a completed search in response order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(200, { items: [placeRow("first"), placeRow("second")] }))
    );
    const result = await fetchDirectSearchHomeCards("맛집");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.cards.map((card) => card.id)).toEqual(["first", "second"]);
  });

  it("treats a completed search with zero rows as an empty result", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { items: [] })));
    await expect(fetchDirectSearchHomeCards("맛집")).resolves.toEqual({ status: "ok", cards: [] });
    expect(
      presentRecommendation({
        primaryFailures: 0,
        primarySuccesses: 1,
        cards: [],
        suppression: "ok",
      })
    ).toEqual({ kind: "empty" });
  });

  it("treats an HTTP error as a failed query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(500, { items: [], error: "failed" }))
    );
    await expect(fetchDirectSearchHomeCards("맛집")).resolves.toEqual({ status: "failed" });
  });

  it("treats a network error as a failed query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    await expect(fetchDirectSearchHomeCards("맛집")).resolves.toEqual({ status: "failed" });
  });

  it("treats a malformed response as a failed query", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items: { id: "not-a-list" } }));
    await expect(fetchDirectSearchHomeCards("맛집")).resolves.toEqual({ status: "failed" });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { error: "failed", items: [placeRow("hidden")] }));
    await expect(fetchDirectSearchHomeCards("맛집")).resolves.toEqual({ status: "failed" });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    });
    await expect(fetchDirectSearchHomeCards("맛집")).resolves.toEqual({ status: "failed" });
  });

  it("keeps only cards from queries that completed when direct search fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(503, { items: [], error: "unavailable" })));
    const direct = await fetchDirectSearchHomeCards("맛집");
    const catalog: CardFetch<{ id: string }> = { status: "ok", cards: [{ id: "catalog-place" }] };
    expect(direct).toEqual({ status: "failed" });
    const cards = catalog.status === "ok" ? catalog.cards : [];
    const presented = presentRecommendation({
      primaryFailures: direct.status === "failed" ? 1 : 0,
      primarySuccesses: catalog.status === "ok" ? 1 : 0,
      cards,
      suppression: "ok",
    });
    expect(presented).toEqual({ kind: "cards", cards });
    if (presented.kind === "cards") {
      expect(presented.cards.map((card) => card.id)).toEqual(["catalog-place"]);
    }
  });

  it("blocks the recommendation when suppression verification fails", () => {
    const presented = presentRecommendation({
      primaryFailures: 0,
      primarySuccesses: 2,
      cards: [{ id: "direct-place" }],
      suppression: "failed",
    });
    expect(presented).toEqual({ kind: "suppression_blocked" });
    expect(presented).not.toHaveProperty("cards");
  });

  it("reports a failed follow-up direct search instead of an empty result", async () => {
    expect(isDirectSearchModeQuery("식당")).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(500, { items: [], error: "failed" })));
    const catalog: CardFetch<{ id: string }> = { status: "failed" };
    const followUp = await fetchDirectSearchHomeCards("식당");
    const results = [catalog, followUp];
    const primaryFailures = results.filter((result) => result.status === "failed").length;
    const primarySuccesses = results.filter((result) => result.status === "ok").length;
    expect(followUp).toEqual({ status: "failed" });
    expect(
      presentRecommendation({
        primaryFailures,
        primarySuccesses,
        cards: [],
        suppression: "ok",
      })
    ).toEqual({ kind: "fetch_failed" });
  });

  it("counts the direct search result with the same primary query tally as the home hook", () => {
    const src = readFileSync(resolve(__dirname, "../../../_hooks/useHomeCards.ts"), "utf8");
    expect(src).toContain("const directSearchResult = await fetchDirectSearchHomeCards");
    expect(src).toContain("directSearchCandidates = takePrimary(directSearchResult)");
  });
});
