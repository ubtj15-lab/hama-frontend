import type { HomeCard } from "@/lib/storeTypes";
import { RECOMMEND_DECK_SIZE, RECOMMEND_POOL_SINGLE_TAB } from "@/lib/recommend/recommendConstants";
import type { NormalizedRecommendRequest, RecommendVertical } from "./normalizeRequest";
import { normalizeRecommendRequest, shouldApplyCultureStrictWhitelist } from "./normalizeRequest";
import { fetchCandidatesV2 } from "./fetchCandidates";
import { filterCandidatesV2 } from "./filterCandidates";
import { scoreCandidatesV2 } from "./scoreCandidates";
import { applyRecommendV2Reasons } from "./buildReasons";
import { pickBeautyV2RotationDeck } from "./beautyDeckRotation";
import { beautyExposureId, recordBeautyRecentExposureIds } from "./beautyRecentExposure";

export type RecommendV2Input = {
  query: string | null | undefined;
  category: string | null | undefined;
  intent: string | null | undefined;
  userLat?: number | null;
  userLng?: number | null;
  poolCap?: number;
  deckSize?: number;
};

export type RecommendV2Output = {
  normalized: NormalizedRecommendRequest;
  deck: HomeCard[];
  pool: HomeCard[];
};

export { normalizeRecommendRequest } from "./normalizeRequest";

function dedupeById(cards: HomeCard[]): HomeCard[] {
  const m = new Map<string, HomeCard>();
  for (const c of cards) {
    const id = String(c?.id ?? "");
    if (id && !m.has(id)) m.set(id, c);
  }
  return [...m.values()];
}

function buildScoredPool(
  vertical: RecommendVertical,
  query: string,
  canonicalIntent: string | null,
  filtered: HomeCard[],
  userLat: number | null | undefined,
  userLng: number | null | undefined
): { pool: HomeCard[]; scored: ReturnType<typeof scoreCandidatesV2> } {
  const scored = scoreCandidatesV2(vertical, query, canonicalIntent, filtered, userLat, userLng);
  const pool = scored.map((s) => ({
    ...s.card,
    recommendationScoreBreakdown: {
      final: s.score,
      distance: null,
      rating: null,
      scenario: null,
      convenience: null,
      behavior: null,
      personal: null,
      activeScenario: "recommend_v2",
    },
  }));
  return { pool, scored };
}

function intentCategoryForVertical(vertical: RecommendVertical): "BEAUTY" | "FITNESS" | "LIFE" | "CAFE" | "FOOD" | "ACTIVITY" | undefined {
  switch (vertical) {
    case "beauty":
      return "BEAUTY";
    case "fitness":
      return "FITNESS";
    case "life":
      return "LIFE";
    case "cafe":
      return "CAFE";
    case "restaurant":
      return "FOOD";
    case "activity":
      return "ACTIVITY";
    default:
      return undefined;
  }
}

export async function getRecommendationsV2(input: RecommendV2Input): Promise<RecommendV2Output> {
  const normalized = normalizeRecommendRequest(input.query, input.category, input.intent);
  const { query, vertical, canonicalCategory, canonicalIntent } = normalized;
  const poolCap = input.poolCap ?? RECOMMEND_POOL_SINGLE_TAB;
  const deckSize = input.deckSize ?? RECOMMEND_DECK_SIZE;

  const filterV2Opts = {
    cultureStrict: shouldApplyCultureStrictWhitelist(input.category, input.intent, input.query),
  };

  console.log("[HAMA_RECOMMEND_V2_REQUEST]", {
    query: input.query ?? "",
    category: input.category ?? null,
    intent: input.intent ?? null,
    canonicalCategory,
    canonicalIntent,
    vertical,
  });

  const fetchPack = await fetchCandidatesV2(vertical, poolCap);

  console.log("[HAMA_RECOMMEND_V2_FETCH]", {
    vertical,
    beforeCount: fetchPack.cards.length,
    source: fetchPack.source,
    fetchTab: fetchPack.fetchTab,
    usedAllFallback: false,
  });

  let mergedRaw = dedupeById([...fetchPack.cards]);

  if (vertical === "beauty") {
    const filterPack = filterCandidatesV2(vertical, mergedRaw, filterV2Opts);
    const { pool, scored } = buildScoredPool(
      vertical,
      query,
      canonicalIntent,
      filterPack.filtered,
      input.userLat,
      input.userLng
    );

    const filterDeckPass = (picked: HomeCard[]) => filterCandidatesV2(vertical, picked, filterV2Opts).filtered;

    const { deck: rawDeck, meta: rotMeta } = pickBeautyV2RotationDeck(pool, deckSize, filterDeckPass);

    const stripPack = filterCandidatesV2(vertical, rawDeck, filterV2Opts);
    if (stripPack.filtered.length < rawDeck.length) {
      console.log("[HAMA_RECOMMEND_V2_DECK_HARD_STRIP]", {
        vertical,
        before: rawDeck.length,
        after: stripPack.filtered.length,
        removed: rawDeck
          .filter((c) => !stripPack.filtered.some((f) => f.id === c.id))
          .slice(0, 12)
          .map((c) => ({ name: c.name, category: c.category, categoryLabel: c.categoryLabel })),
      });
    }

    const deckSlice = applyRecommendV2Reasons(stripPack.filtered.slice(0, deckSize), vertical, {
      intentCategory: intentCategoryForVertical(vertical),
    });

    recordBeautyRecentExposureIds(deckSlice.map((c) => beautyExposureId(c)));

    console.log("[HAMA_BEAUTY_V2_ROTATION]", {
      candidateCount: rotMeta.candidateCount,
      scoredPoolCount: rotMeta.scoredPoolCount,
      recentExcludedCount: rotMeta.recentExcludedCount,
      finalCards: deckSlice.map((c) => ({
        id: beautyExposureId(c),
        name: c.name,
        category: c.category ?? null,
        categoryLabel: c.categoryLabel ?? null,
      })),
    });

    console.log("[HAMA_RECOMMEND_V2_FILTER]", {
      vertical,
      beforeCount: fetchPack.cards.length,
      afterCount: filterPack.filtered.length,
      rejectedExamples: filterPack.rejectedExamples.slice(0, 12),
      acceptedExamples: filterPack.acceptedExamples.slice(0, 12),
    });

    console.log("[HAMA_RECOMMEND_V2_SCORE]", {
      vertical,
      finalCount: deckSlice.length,
      topExamples: scored.slice(0, 10).map((s) => ({
        name: s.card.name,
        category: s.card.category ?? null,
        categoryLabel: s.card.categoryLabel ?? null,
        score: s.score,
      })),
    });

    return { normalized, deck: deckSlice, pool };
  }

  const filterPack = filterCandidatesV2(vertical, mergedRaw, filterV2Opts);

  console.log("[HAMA_RECOMMEND_V2_FILTER]", {
    vertical,
    beforeCount: fetchPack.cards.length,
    afterCount: filterPack.filtered.length,
    rejectedExamples: filterPack.rejectedExamples.slice(0, 12),
    acceptedExamples: filterPack.acceptedExamples.slice(0, 12),
  });

  const { pool, scored } = buildScoredPool(
    vertical,
    query,
    canonicalIntent,
    filterPack.filtered,
    input.userLat,
    input.userLng
  );

  const deck = applyRecommendV2Reasons(pool.slice(0, deckSize), vertical, {
    intentCategory: intentCategoryForVertical(vertical),
  });

  console.log("[HAMA_RECOMMEND_V2_SCORE]", {
    vertical,
    finalCount: deck.length,
    topExamples: scored.slice(0, 10).map((s) => ({
      name: s.card.name,
      category: s.card.category ?? null,
      categoryLabel: s.card.categoryLabel ?? null,
      score: s.score,
    })),
  });

  return { normalized, deck, pool };
}
