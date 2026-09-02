import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { classifyDiscoveryQuery } from "../discoveryRole";
import { finalizeRecommendations, isExplicitKidsRecommendationContext } from "../finalizeRecommendations";
import { isHighConfidenceAdultVenueHaystack } from "../childFriendlyScore";
import { mergeExcludeForDisplayedDeck, mergeExcludeForMainReject } from "../fallbackRecommend";
import {
  applyRepeatAvoidanceToOrderedDeck,
  isDateRepeatAvoidanceContext,
  repeatAvoidanceContextKey,
  shouldApplyDateRepeatAvoidance,
} from "../dateRepeatAvoidance";
import {
  readContextRecentExposedIds,
  saveContextRecentExposedIds,
} from "../recentExposure";
import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendScoreBreakdown, ScoredRecommendItem } from "../scoring";

function card(partial: Partial<HomeCard> & Pick<HomeCard, "id" | "name" | "category">): HomeCard {
  return {
    lat: 37.2009,
    lng: 127.0957,
    area: null,
    address: null,
    image_url: null,
    mood: ["분위기", "데이트"],
    tags: ["분위기", "데이트"],
    description: "분위기 좋은 데이트 장소",
    updated_at: null,
    with_kids: false,
    for_work: null,
    reservation_required: null,
    vegetarian_available: null,
    halal_available: null,
    price_level: null,
    ...partial,
  };
}

function scored(c: HomeCard, finalScore: number): ScoredRecommendItem {
  return {
    card: c,
    reasonText: "",
    reasonVoice: "date",
    breakdown: { finalScore } as RecommendScoreBreakdown,
  };
}

const A = card({ id: "date-a", name: "분위기파스타A", category: "restaurant", distanceKm: 2 });
const B = card({ id: "date-b", name: "감성카페B", category: "cafe", distanceKm: 3 });
const C = card({ id: "date-c", name: "와인바C", category: "restaurant", distanceKm: 4 });
const D = card({ id: "date-d", name: "브런치D", category: "cafe", distanceKm: 5 });
const E = card({ id: "date-e", name: "스테이크E", category: "restaurant", distanceKm: 6 });
const F = card({ id: "date-f", name: "이탈리안F", category: "restaurant", distanceKm: 7 });
const G = card({ id: "date-g", name: "오마카세G", category: "restaurant", distanceKm: 8 });
const H = card({ id: "date-h", name: "루프탑H", category: "cafe", distanceKm: 9 });
const I = card({ id: "date-i", name: "기념일I", category: "restaurant", distanceKm: 10 });
const FAR = card({
  id: "bangbros-range",
  name: "뱅브로스 실내사격장",
  category: "activity",
  distanceKm: 39.1,
  mood: ["액티비티"],
  tags: ["사격"],
  description: "실내사격",
});
const HEADS_UP = card({
  id: "6bcfa8ae-853c-4437-a811-b860205cb07a",
  name: "헤즈업홀덤펍 동탄점",
  category: "activity",
  distanceKm: 2,
  mood: ["홀덤"],
  tags: ["펍"],
  description: "홀덤펍",
});
const KIDS_PLAY = card({
  id: "kids-play-1",
  name: "나만의 키즈카페",
  category: "activity",
  tags: ["키즈카페", "실내", "놀이"],
  mood: ["키즈"],
  description: "키즈카페 실내 놀이",
  with_kids: true,
  distanceKm: 4,
});

const DATE_POOL = [A, B, C, D, E, F, G, H, I].map((c, i) => scored(c, 90 - i));

function runDate(avoidPlaceIds: string[] = []) {
  const query = "데이트";
  const parsed = parseScenarioIntent(query);
  const ranked = [...DATE_POOL];
  return finalizeRecommendations({
    query,
    parsed,
    ranked,
    scoredPool: ranked,
    deckSize: 3,
    avoidPlaceIds,
  });
}

function installMemorySessionStorage() {
  const store = new Map<string, string>();
  const ss = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  (globalThis as { window?: { sessionStorage: typeof ss } }).window = { sessionStorage: ss };
  return ss;
}

describe("DATE repeat avoidance", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("A: fresh DATE with no exposure keeps the original strongest TOP3", () => {
    const first = runDate();
    const again = runDate([]);
    expect(first.applied).toBe(true);
    expect(first.classification.role).toBe("DATE");
    expect(again.deck.map((d) => d.card.id)).toEqual(first.deck.map((d) => d.card.id));
    expect(first.deck).toHaveLength(3);
  });

  it("B: repeating DATE with alternatives D/E/F avoids previous A/B/C", () => {
    const first = runDate();
    const prev = first.deck.map((d) => d.card.id);
    expect(prev).toHaveLength(3);
    const second = runDate(prev);
    const next = second.deck.map((d) => d.card.id);
    expect(next).toHaveLength(3);
    for (const id of prev) {
      expect(next).not.toContain(id);
    }
  });

  it("C: 다른 추천 보기 treats the full current TOP3 as previous exposure", () => {
    expect(mergeExcludeForMainReject([], "date-a")).toEqual(["date-a"]);
    expect(mergeExcludeForDisplayedDeck([], ["date-a", "date-b", "date-c"])).toEqual([
      "date-a",
      "date-b",
      "date-c",
    ]);
    const first = runDate();
    const top3 = first.deck.map((d) => d.card.id);
    const avoided = mergeExcludeForDisplayedDeck([], top3);
    const refreshed = runDate(avoided);
    const next = refreshed.deck.map((d) => d.card.id);
    expect(next.some((id) => avoided.includes(id))).toBe(false);

    const pageSrc = readFileSync(resolve(__dirname, "../../../results/page.tsx"), "utf8");
    expect(pageSrc).toContain("mergeExcludeForDisplayedDeck");
    expect(pageSrc).toContain("primaryListCards.slice(0, RECOMMEND_DECK_SIZE)");
    expect(pageSrc).not.toMatch(/setRejectedMainPickIds\(\(prev\) => \[\.\.\.new Set\(\[\.\.\.prev, id\]\)\]\)/);
  });

  it("D: only two unseen alternatives still succeed and may fill with a prior candidate", () => {
    const tiny = [A, B, C, D, E].map((c, i) => scored(c, 90 - i));
    const query = "데이트";
    const parsed = parseScenarioIntent(query);
    const first = finalizeRecommendations({
      query,
      parsed,
      ranked: tiny,
      scoredPool: tiny,
      deckSize: 3,
    });
    const prev = first.deck.map((d) => d.card.id);
    const second = finalizeRecommendations({
      query,
      parsed,
      ranked: tiny,
      scoredPool: tiny,
      deckSize: 3,
      avoidPlaceIds: prev,
    });
    expect(second.deck.length).toBeGreaterThanOrEqual(2);
    expect(second.deck.length).toBeLessThanOrEqual(3);
    const unseen = second.deck.filter((d) => !prev.includes(d.card.id));
    expect(unseen.length).toBeGreaterThanOrEqual(2);
  });

  it("E: exhausted alternatives return the strongest valid previous places", () => {
    const onlyThree = [A, B, C].map((c, i) => scored(c, 90 - i));
    const query = "데이트";
    const parsed = parseScenarioIntent(query);
    const first = finalizeRecommendations({
      query,
      parsed,
      ranked: onlyThree,
      scoredPool: onlyThree,
      deckSize: 3,
    });
    const prev = first.deck.map((d) => d.card.id);
    const second = finalizeRecommendations({
      query,
      parsed,
      ranked: onlyThree,
      scoredPool: onlyThree,
      deckSize: 3,
      avoidPlaceIds: prev,
    });
    expect(second.deck.map((d) => d.card.id).sort()).toEqual([...prev].sort());
    expect(second.deck).toHaveLength(3);
  });

  it("F: Home remount / new recommendation id still reads same DATE context exposure", () => {
    installMemorySessionStorage();
    const first = runDate();
    const top3 = first.deck.map((d) => d.card.id);
    const key = repeatAvoidanceContextKey("데이트", "date");
    saveContextRecentExposedIds(key, top3);
    const persisted = readContextRecentExposedIds(key);
    expect(persisted.slice(0, 3)).toEqual(top3);
    const remount = runDate(persisted);
    for (const id of top3) {
      expect(remount.deck.map((d) => d.card.id)).not.toContain(id);
    }
    const pageSrc = readFileSync(resolve(__dirname, "../../../results/page.tsx"), "utf8");
    expect(pageSrc).toContain("readContextRecentExposedIds");
    expect(pageSrc).toContain("repeatAvoidPlaceIds: sessionRepeatAvoidIds");
    expect(pageSrc).toMatch(/useEffect\(\(\) => \{\s*const parsed = parseScenarioIntent\(qRaw\);/);
  });

  it("G: 데이트 → 뭐 먹지 uses a different context key and does not inherit DATE TOP3", () => {
    const dateKey = repeatAvoidanceContextKey("데이트", "date");
    const foodParsed = parseScenarioIntent("뭐 먹지");
    const foodKey = repeatAvoidanceContextKey("뭐 먹지", foodParsed.scenario);
    expect(dateKey).not.toBe(foodKey);
    expect(shouldApplyDateRepeatAvoidance("뭐 먹지", foodParsed, classifyDiscoveryQuery("뭐 먹지", foodParsed))).toBe(
      false
    );
    installMemorySessionStorage();
    saveContextRecentExposedIds(dateKey, ["date-a", "date-b", "date-c"]);
    expect(readContextRecentExposedIds(foodKey)).toEqual([]);
    expect(isDateRepeatAvoidanceContext("뭐 먹지", foodParsed)).toBe(false);
  });

  it("H: named place 뱅브로스 실내사격장 찾아줘 stays eligible", () => {
    const query = "뱅브로스 실내사격장 찾아줘";
    const parsed = parseScenarioIntent(query);
    expect(shouldApplyDateRepeatAvoidance(query, parsed, classifyDiscoveryQuery(query, parsed))).toBe(false);
    const out = finalizeRecommendations({
      query,
      parsed,
      ranked: [scored(FAR, 99), scored(A, 80), scored(B, 70)],
      scoredPool: [scored(FAR, 99), scored(A, 80), scored(B, 70)],
      deckSize: 3,
      avoidPlaceIds: ["bangbros-range"],
    });
    expect(out.eligiblePool.map((d) => d.card.id)).toContain("bangbros-range");
    expect(out.deck.map((d) => d.card.id)).toContain("bangbros-range");
  });

  it("I: 39km ordinary local stays excluded even when novelty pool is small", () => {
    const query = "데이트";
    const parsed = parseScenarioIntent(query);
    const pool = [scored(FAR, 99), scored(A, 80), scored(B, 70)];
    const first = finalizeRecommendations({ query, parsed, ranked: pool, scoredPool: pool, deckSize: 3 });
    expect(first.eligiblePool.map((d) => d.card.id)).not.toContain("bangbros-range");
    const second = finalizeRecommendations({
      query,
      parsed,
      ranked: pool,
      scoredPool: pool,
      deckSize: 3,
      avoidPlaceIds: first.deck.map((d) => d.card.id),
    });
    expect(second.eligiblePool.map((d) => d.card.id)).not.toContain("bangbros-range");
    expect(second.deck.map((d) => d.card.id)).not.toContain("bangbros-range");
  });

  it("J: kids/adult safety still blocks an adult venue in kids context", () => {
    const query = "아이랑 갈만한 곳";
    const parsed = parseScenarioIntent(query);
    expect(isExplicitKidsRecommendationContext(parsed)).toBe(true);
    expect(isHighConfidenceAdultVenueHaystack("헤즈업홀덤펍 동탄점 activity")).toBe(true);
    const pool = [scored(HEADS_UP, 99), scored(KIDS_PLAY, 70), scored(A, 60)];
    const out = finalizeRecommendations({
      query,
      parsed,
      ranked: pool,
      scoredPool: pool,
      deckSize: 3,
      avoidPlaceIds: [KIDS_PLAY.id],
    });
    expect(out.eligiblePool.map((d) => d.card.id)).not.toContain(HEADS_UP.id);
    expect(out.deck.map((d) => d.card.id)).not.toContain(HEADS_UP.id);
  });

  it("two-pass helper prefers unseen then fills from prior in original order", () => {
    const ordered = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
    expect(applyRepeatAvoidanceToOrderedDeck(ordered, [], 3).map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(applyRepeatAvoidanceToOrderedDeck(ordered, ["a", "b", "c"], 3).map((x) => x.id)).toEqual([
      "d",
      "e",
      "a",
    ]);
  });
});
