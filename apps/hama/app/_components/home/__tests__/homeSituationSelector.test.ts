import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import {
  DEFAULT_HOME_SLOT_IDS,
  EMPTY_HOME_PERSONALIZATION,
  HOME_SITUATION_CANDIDATES,
  MAX_HOME_SITUATION_SLOTS,
} from "../homeSituationCandidates";
import {
  HOME_SITUATION_DECK_COUNT,
  selectHomeSituationSlots,
  situationDecksForContext,
  buildHomeSituationContext,
} from "../homeSituationSelector";

function idsOf(now: Date, deckIndex = 0) {
  return selectHomeSituationSlots({ now, deckIndex, personalization: EMPTY_HOME_PERSONALIZATION }).slots.map(
    (s) => s.id
  );
}

describe("Home situation candidate library", () => {
  it("keeps unique ids and a 10–16 candidate library", () => {
    const ids = HOME_SITUATION_CANDIDATES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(HOME_SITUATION_CANDIDATES.length).toBeGreaterThanOrEqual(10);
    expect(HOME_SITUATION_CANDIDATES.length).toBeLessThanOrEqual(16);
  });

  it("maps every candidate query through the existing parser", () => {
    for (const candidate of HOME_SITUATION_CANDIDATES) {
      expect(candidate.query.trim().length).toBeGreaterThan(0);
      expect(candidate.reasonLabel).toBeUndefined();
      const parsed = parseScenarioIntent(candidate.query);
      expect(parsed).toBeTruthy();
      expect(parsed.intentType).toMatch(/scenario_recommendation|search_strict|course_generation/);
    }
  });

  it("keeps the V4 fallback options in the library", () => {
    const byId = Object.fromEntries(HOME_SITUATION_CANDIDATES.map((c) => [c.id, c]));
    expect(DEFAULT_HOME_SLOT_IDS).toEqual(["family_outing", "date", "food", "outdoor_walk"]);
    expect(byId.family_outing.query).toBe("아이랑 갈만한 곳");
    expect(byId.date.query).toBe("데이트");
    expect(byId.food.query).toBe("뭐 먹지");
    expect(byId.outdoor_walk.query).toBe("산책하다 들를 곳");
  });
});

describe("Home situation slot selector", () => {
  it("returns exactly 4 unique slots for empty personalization", () => {
    const now = new Date(2026, 7, 26, 12, 0, 0);
    const result = selectHomeSituationSlots({ now, personalization: {} });
    expect(result.slots).toHaveLength(MAX_HOME_SITUATION_SLOTS);
    expect(new Set(result.slots.map((s) => s.id)).size).toBe(4);
    expect(result.slots.every((s) => s.query.trim())).toBe(true);
    expect(result.slots.some((s) => s.reasonLabel)).toBe(false);
  });

  it("is deterministic for the same context", () => {
    const now = new Date(2026, 7, 26, 12, 0, 0);
    expect(idsOf(now)).toEqual(idsOf(new Date(2026, 7, 26, 12, 0, 0)));
  });

  it("uses the recognizable default set at weekday lunch", () => {
    const now = new Date(2026, 7, 26, 12, 0, 0);
    expect(now.getDay()).toBe(3);
    expect(idsOf(now)).toEqual(["family_outing", "date", "food", "outdoor_walk"]);
    const families = selectHomeSituationSlots({ now, personalization: {} }).slots.map((s) => s.semanticFamily);
    expect(new Set(families).size).toBe(4);
  });

  it("selects weekend afternoon without rain or random", () => {
    const now = new Date(2026, 7, 30, 14, 0, 0);
    expect(now.getDay()).toBe(0);
    expect(idsOf(now)).toEqual(["family_outing", "date", "outdoor_walk", "discovery"]);
  });

  it("selects weekday morning from an explicit deck", () => {
    const now = new Date(2026, 7, 25, 9, 0, 0);
    expect(now.getDay()).toBe(2);
    expect(idsOf(now)).toEqual(["food", "relax", "outdoor_walk", "date"]);
  });

  it("selects weekday evening from an explicit deck", () => {
    const now = new Date(2026, 7, 28, 19, 0, 0);
    expect(now.getDay()).toBe(5);
    expect(idsOf(now)).toEqual(["date", "food", "relax", "indoor"]);
  });

  it("never surfaces rainy-only candidates without weather", () => {
    const samples = [
      new Date(2026, 7, 25, 9, 0, 0),
      new Date(2026, 7, 26, 12, 0, 0),
      new Date(2026, 7, 28, 19, 0, 0),
      new Date(2026, 7, 30, 14, 0, 0),
    ];
    for (const now of samples) {
      const ctx = buildHomeSituationContext(now);
      expect(ctx.rainy).toBe(false);
      for (let i = 0; i < HOME_SITUATION_DECK_COUNT; i += 1) {
        expect(idsOf(now, i)).not.toContain("indoor_rain");
      }
    }
  });

  it("rotates decks deterministically without duplicates or Math.random", () => {
    const now = new Date(2026, 7, 26, 12, 0, 0);
    const a = idsOf(now, 0);
    const b = idsOf(now, 1);
    const c = idsOf(now, 2);
    const a2 = idsOf(now, 3);
    expect(a).toEqual(["family_outing", "date", "food", "outdoor_walk"]);
    expect(b).not.toEqual(a);
    expect(c).not.toEqual(a);
    expect(c).not.toEqual(b);
    expect(a2).toEqual(a);
    expect(new Set(b).size).toBe(4);
    expect(new Set(c).size).toBe(4);
    const decks = situationDecksForContext(buildHomeSituationContext(now));
    expect(decks).toHaveLength(3);
  });
});
