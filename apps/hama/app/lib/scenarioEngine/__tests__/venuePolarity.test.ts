import { describe, expect, it } from "vitest";
import { parseQueryNegation } from "../negationUnderstanding";
import { parseScenarioIntent } from "../parseScenarioIntent";
import { understandQuery } from "../queryUnderstanding";
import {
  applyVenuePolarityToParsedQuery,
  reconcileVenuePolarity,
} from "../venuePolarity";
import type { ParsedRecommendationQuery } from "../types";

function venueIds(q: string) {
  const uq = understandQuery(q);
  return {
    positive: uq.venueIntents ?? [],
    excluded: uq.negation?.excludedVenues ?? [],
    purpose: uq.purposeIntents ?? [],
    companion: uq.companionIntents ?? [],
    polarity: uq.venuePolarity,
    remainderPurpose: uq.negation?.positivePurpose ?? [],
  };
}

describe("venue polarity v1", () => {
  it("키즈카페 추천 keeps positive venue and has no exclusion", () => {
    const r = venueIds("키즈카페 추천");
    expect(r.positive).toContain("kids_cafe");
    expect(r.excluded).toEqual([]);
    expect(r.polarity?.contradictionResolved).toBe(false);
  });

  it("키즈카페 말고 excludes kids_cafe and drops positive venue", () => {
    const r = venueIds("키즈카페 말고");
    expect(r.excluded).toContain("kids_cafe");
    expect(r.positive).not.toContain("kids_cafe");
    expect(r.polarity?.positiveBefore).toContain("kids_cafe");
    expect(r.polarity?.removedByExclusion).toContain("kids_cafe");
    expect(r.polarity?.contradictionResolved).toBe(true);
  });

  it("키즈카페 말고 아이랑 놀 곳 drops positive kids_cafe but keeps play/family remainder", () => {
    const r = venueIds("키즈카페 말고 아이랑 놀 곳");
    expect(r.excluded).toContain("kids_cafe");
    expect(r.positive).not.toContain("kids_cafe");
    expect(r.purpose).not.toContain("kids_cafe");
    expect(r.remainderPurpose).toEqual(expect.arrayContaining(["FAMILY", "PLAY"]));
    const parsed = parseScenarioIntent("키즈카페 말고 아이랑 놀 곳");
    expect(parsed.queryUnderstanding?.venueIntents ?? []).not.toContain("kids_cafe");
    expect(parsed.withKids === true || (parsed.queryUnderstanding?.companionIntents ?? []).includes("child")).toBe(true);
  });

  it("키즈카페는 지겨워서 다른 놀 곳 drops positive kids_cafe and keeps alternative play", () => {
    const n = parseQueryNegation("키즈카페는 지겨워서 다른 놀 곳");
    expect(n.excludedVenues).toContain("kids_cafe");
    const r = venueIds("키즈카페는 지겨워서 다른 놀 곳");
    expect(r.positive).not.toContain("kids_cafe");
    expect(r.remainderPurpose).toEqual(expect.arrayContaining(["PLAY"]));
  });

  it("non-negated venue query leaves positive venue unchanged", () => {
    const r = venueIds("근처 키즈카페 가고 싶다");
    expect(r.excluded).toEqual([]);
    expect(r.positive).toContain("kids_cafe");
  });

  it("synthetic: positive A + excluded B keeps A", () => {
    const debug = reconcileVenuePolarity(["kids_cafe"], ["alcohol"]);
    expect(debug.positiveAfter).toEqual(["kids_cafe"]);
    expect(debug.removedByExclusion).toEqual([]);
    expect(debug.contradictionResolved).toBe(false);

    const parsed: ParsedRecommendationQuery = {
      rawQuery: "synthetic A vs B",
      normalizedQuery: "synthetic a vs b",
      venueIntents: ["kids_cafe"],
      purposeIntents: ["kids_cafe"],
      menuIntents: ["키즈카페"],
      negation: {
        ...parseQueryNegation("술집 말고"),
        excludedVenues: ["alcohol"],
        isNegationQuery: true,
      },
    };
    const out = applyVenuePolarityToParsedQuery(parsed);
    expect(out.venueIntents).toEqual(["kids_cafe"]);
    expect(out.purposeIntents).toContain("kids_cafe");
  });

  it("synthetic: same canonical venue positive+excluded removes positive", () => {
    const debug = reconcileVenuePolarity(["kids_cafe", "alcohol"], ["kids_cafe"]);
    expect(debug.positiveAfter).toEqual(["alcohol"]);
    expect(debug.removedByExclusion).toEqual(["kids_cafe"]);
    expect(debug.contradictionResolved).toBe(true);

    const parsed: ParsedRecommendationQuery = {
      rawQuery: "키즈카페 말고",
      normalizedQuery: "키즈카페 말고",
      venueIntents: ["kids_cafe"],
      purposeIntents: ["kids_cafe"],
      menuIntents: ["키즈카페"],
      negation: parseQueryNegation("키즈카페 말고"),
    };
    const out = applyVenuePolarityToParsedQuery(parsed);
    expect(out.venueIntents ?? []).not.toContain("kids_cafe");
    expect(out.purposeIntents ?? []).not.toContain("kids_cafe");
    expect(out.menuIntents ?? []).not.toContain("키즈카페");
  });

  it("same input is deterministic", () => {
    const a = understandQuery("키즈카페 말고 아이랑 놀 곳");
    const b = understandQuery("키즈카페 말고 아이랑 놀 곳");
    expect(a.venueIntents).toEqual(b.venueIntents);
    expect(a.venuePolarity).toEqual(b.venuePolarity);
    expect(a.purposeIntents).toEqual(b.purposeIntents);
  });
});
