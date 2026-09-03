import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { resolveHomeResultsUrl } from "@/lib/hamaTabClickTrace";
import {
  classifyDiscoveryQuery,
  isIndoorPlaySeekingQuery,
  shouldHideHoldemPokerForGenericIndoorPlay,
} from "@/lib/recommend/discoveryRole";
import { isExplicitKidsRecommendationContext } from "@/lib/recommend/finalizeRecommendations";
import { getHomeSituationCandidate } from "../homeSituationCandidates";

describe("HOME_DISPLAY_INTENT_AND_QUERY_CONTRACT", () => {
  const indoor = getHomeSituationCandidate("indoor");

  it("keeps the displayed indoor play meaning", () => {
    expect(indoor).toBeTruthy();
    expect(indoor!.displayTitle).toBe("오늘은 실내에서 놀까?");
    expect(indoor!.line2).toBe("실내에서 놀까?");
  });

  it("does not ship bare 실내", () => {
    expect(indoor!.query).not.toBe("실내");
    expect(indoor!.query.trim()).not.toBe("실내");
  });

  it("sends an explicit indoor play query", () => {
    expect(indoor!.query).toBe("오늘 실내에서 놀까?");
  });

  it("Home indoor card query reaches PLAY on the actual Results URL path", () => {
    const nextUrl = resolveHomeResultsUrl(indoor!.query);
    const q = new URLSearchParams(nextUrl.split("?")[1] ?? "").get("q");
    expect(nextUrl.startsWith("/results?")).toBe(true);
    expect(q).toBe("오늘 실내에서 놀까?");
    expect(q).toBe(indoor!.query);

    const parsed = parseScenarioIntent(q!);
    const classification = classifyDiscoveryQuery(q!, parsed);
    expect(isIndoorPlaySeekingQuery(q!, parsed)).toBe(true);
    expect(classification.isDiscovery).toBe(true);
    expect(classification.role).toBe("PLAY");
    expect(parsed.withKids).not.toBe(true);
    expect(isExplicitKidsRecommendationContext(parsed)).toBe(false);
    expect(shouldHideHoldemPokerForGenericIndoorPlay(q!, parsed)).toBe(true);
  });

  it("Results path keeps indoor-evidence activities in the Home indoor PLAY pool", () => {
    const src = readFileSync(resolve(__dirname, "../../../_hooks/useHomeCards.ts"), "utf8");
    expect(src).toContain("indoor_play:activity_catalog");
    expect(src).toContain("hasCredibleIndoorPlayEvidence");
    expect(src).toContain("isIndoorPlaySeekingQuery");
  });
});
