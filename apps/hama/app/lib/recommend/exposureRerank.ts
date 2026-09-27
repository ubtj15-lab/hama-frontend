/**
 * Independent exposure / diversity rerank layer.
 *
 * Ranking relevance (hybrid + menu matching) is not modified here.
 * This layer only reorders candidates inside a relevance band using a frozen
 * cross-query exposure snapshot — so production can pass user-history exposure
 * later without overwriting personalization already baked into `score`.
 *
 * No Math.random: ties break by original rank then store id.
 */

export type QueryExposureClass = "explicit_menu" | "strict_vertical" | "discovery";
export type RelevanceStrength = "STRONG" | "MEDIUM" | "WEAK";

export type ExposurePenaltyReason =
  | "NO_PENALTY"
  | "STRONG_EXPLICIT_RELEVANCE"
  | "CANDIDATE_SCARCITY"
  | "SAME_MENU_QUERY_FAMILY"
  | "HIGH_CROSS_QUERY_EXPOSURE"
  | "SIMILAR_ALTERNATIVES_AVAILABLE"
  | "WEAK_QUERY_SPECIFIC_RELEVANCE"
  | "DISCOVERY_CATEGORY_SPREAD";

export type ExposureStoreStats = {
  storeId: string;
  top1Count: number;
  top3Count: number;
  fingerprints: string[];
};

export type ExposureSnapshot = {
  scenarioCount: number;
  totalTop3Slots: number;
  meanTop3: number;
  stores: Record<string, ExposureStoreStats>;
};

export type ExposureRerankItem<T> = {
  id: string;
  name: string;
  category: string | null;
  score: number;
  menuTier?: string | null;
  foodIntentScore?: number;
  keywordScore?: number;
  payload: T;
};

export type ExposureQueryContext = {
  query: string;
  intentType?: string | null;
  intentCategory?: string | null;
  scenario?: string | null;
  menuIntent?: string[] | null;
  route?: string | null;
};

export type ExposureRerankOptions = {
  deckSize?: number;
  poolLimit?: number;
  /** Diagnostic only. Omit in default production/sim path. */
  hardCap?: number | null;
  /** Ranking-v2 deck ids. Diversity only substitutes inside this structure. */
  naturalDeckIds?: string[];
};

export type ExposureItemDebug = {
  storeId: string;
  name: string;
  baseRankingScore: number;
  top3CountBefore: number;
  relevance: RelevanceStrength;
  diversityPenalty: number;
  adjustedScore: number;
  finalRank: number;
  reasons: ExposurePenaltyReason[];
};

export type ExposureRerankResult<T> = {
  deck: ExposureRerankItem<T>[];
  debug: ExposureItemDebug[];
  queryClass: QueryExposureClass;
  bandThreshold: number;
  bandSize: number;
};

export const EXPOSURE_POOL_LIMIT = 24;
export const EXPOSURE_BAND_MIN = 6;
export const EXPOSURE_BAND_MAX = 10;
export const EXPOSURE_BAND_RATIO = 0.11;

export function queryFingerprint(ctx: ExposureQueryContext): string {
  const menus = [...(ctx.menuIntent ?? [])].filter(Boolean).sort();
  if (menus.length) return `menu:${menus.join(",")}`;
  if (ctx.intentType === "search_strict" && ctx.intentCategory) {
    return `strict:${ctx.intentCategory}`;
  }
  return `disc:${ctx.scenario ?? "generic"}:${ctx.route ?? "MIXED"}`;
}

export function classifyQueryExposure(ctx: ExposureQueryContext): QueryExposureClass {
  if ((ctx.menuIntent?.length ?? 0) > 0) return "explicit_menu";
  if (ctx.intentType === "search_strict" && ctx.intentCategory) return "strict_vertical";
  return "discovery";
}

export function relevanceStrength(item: {
  menuTier?: string | null;
  foodIntentScore?: number;
  keywordScore?: number;
}): RelevanceStrength {
  const tier = item.menuTier ?? "none";
  if (tier === "exact" || tier === "synonym") return "STRONG";
  if (tier === "semantic" || (item.foodIntentScore ?? 0) >= 40 || (item.keywordScore ?? 0) >= 35) {
    return "MEDIUM";
  }
  return "WEAK";
}

export function relevanceBandThreshold(bestScore: number): number {
  if (!Number.isFinite(bestScore) || bestScore <= 0) return EXPOSURE_BAND_MIN;
  const rel = bestScore * EXPOSURE_BAND_RATIO;
  return Math.max(EXPOSURE_BAND_MIN, Math.min(EXPOSURE_BAND_MAX, rel));
}

export function buildExposureSnapshot(
  decks: Array<{ id: string }[]>,
  fingerprints: string[]
): ExposureSnapshot {
  const stores: Record<string, ExposureStoreStats> = {};
  let top3Slots = 0;
  decks.forEach((deck, qi) => {
    const fp = fingerprints[qi] ?? "";
    deck.forEach((item, idx) => {
      if (!item?.id) return;
      top3Slots += 1;
      const prev = stores[item.id] ?? {
        storeId: item.id,
        top1Count: 0,
        top3Count: 0,
        fingerprints: [],
      };
      prev.top3Count += 1;
      if (idx === 0) prev.top1Count += 1;
      if (fp && !prev.fingerprints.includes(fp)) prev.fingerprints.push(fp);
      stores[item.id] = prev;
    });
  });
  const counts = Object.values(stores).map((s) => s.top3Count);
  const meanTop3 = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  return {
    scenarioCount: decks.length,
    totalTop3Slots: top3Slots,
    meanTop3,
    stores,
  };
}

function nameQueryTokenHit(name: string, query: string): boolean {
  const n = String(name ?? "").replace(/\s+/g, "");
  const q = String(query ?? "").replace(/\s+/g, "");
  if (n.length < 2 || q.length < 2) return false;
  const keywords = [
    "빵",
    "케이크",
    "베이커",
    "카페",
    "냉면",
    "막국",
    "칼국",
    "국수",
    "떡볶",
    "김밥",
    "라면",
    "갈비",
    "고기",
    "삼겹",
    "돈가",
    "초밥",
    "키즈",
    "북카페",
    "공원",
    "분식",
  ];
  if (keywords.some((k) => n.includes(k) && q.includes(k))) return true;
  const stop = ["오산", "동탄", "테크노", "밸리", "롯데", "백화점", "시청", "본점", "직영"];
  for (let i = 0; i < n.length - 1; i++) {
    const gram = n.slice(i, i + 2);
    if (stop.some((s) => s.includes(gram))) continue;
    if (q.includes(gram)) return true;
  }
  return false;
}

function categoryKey(category: string | null | undefined): string {
  return String(category ?? "unknown").toLowerCase();
}

function isBlockedForQuery(item: { category: string | null }, ctx: ExposureQueryContext, queryClass: QueryExposureClass): boolean {
  const cat = categoryKey(item.category);
  if (queryClass === "explicit_menu") return false;
  if (ctx.intentCategory === "BEAUTY") return false;
  if (cat === "salon") return true;
  return false;
}

function exposurePenalty(args: {
  top3Count: number;
  meanTop3: number;
  strength: RelevanceStrength;
  queryClass: QueryExposureClass;
  sameMenuFamily: boolean;
  bandPeerCount: number;
  hardCap?: number | null;
}): { penalty: number; reasons: ExposurePenaltyReason[] } {
  const reasons: ExposurePenaltyReason[] = [];
  const { top3Count, meanTop3, strength, queryClass, sameMenuFamily, bandPeerCount } = args;

  if (queryClass === "explicit_menu" && strength === "STRONG") {
    return { penalty: 0, reasons: ["STRONG_EXPLICIT_RELEVANCE"] };
  }
  if (sameMenuFamily && queryClass === "explicit_menu") {
    return { penalty: 0, reasons: ["SAME_MENU_QUERY_FAMILY"] };
  }
  if (strength === "STRONG" && bandPeerCount <= 2) {
    return { penalty: 0, reasons: ["CANDIDATE_SCARCITY"] };
  }

  const start =
    queryClass === "discovery" ? Math.max(8, meanTop3) : queryClass === "strict_vertical" ? 14 : 20;
  const excess = top3Count - start;

  const cap = queryClass === "discovery" ? 3.6 : queryClass === "strict_vertical" ? 2.8 : 2.0;
  if (args.hardCap && args.hardCap > 0 && top3Count >= args.hardCap && strength !== "STRONG") {
    reasons.push("HIGH_CROSS_QUERY_EXPOSURE");
    return { penalty: Math.max(6, cap), reasons };
  }
  if (excess <= 0) {
    return { penalty: 0, reasons: ["NO_PENALTY"] };
  }

  let per = queryClass === "discovery" ? 0.2 : queryClass === "strict_vertical" ? 0.14 : 0.08;
  if (strength === "WEAK") per *= 1.15;
  if (bandPeerCount >= 3) {
    reasons.push("SIMILAR_ALTERNATIVES_AVAILABLE");
  } else {
    per *= 0.3;
  }

  let penalty = Math.min(cap, excess * per);
  if (penalty > 0.4) reasons.push("HIGH_CROSS_QUERY_EXPOSURE");
  if (strength === "WEAK") reasons.push("WEAK_QUERY_SPECIFIC_RELEVANCE");
  if (penalty <= 0.15) return { penalty: 0, reasons: reasons.length ? reasons : ["NO_PENALTY"] };
  return { penalty, reasons };
}

/**
 * Reorder inside the relevance band only. Items below the band never outrank the band.
 */
export function applyExposureRerank<T>(
  items: ExposureRerankItem<T>[],
  ctx: ExposureQueryContext,
  snapshot: ExposureSnapshot,
  options: ExposureRerankOptions = {}
): ExposureRerankResult<T> {
  const deckSize = options.deckSize ?? 3;
  const poolLimit = options.poolLimit ?? EXPOSURE_POOL_LIMIT;
  const queryClass = classifyQueryExposure(ctx);
  const fp = queryFingerprint(ctx);
  const ranked = [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });
  const pool = ranked.slice(0, Math.max(deckSize, poolLimit));
  if (!pool.length) {
    return { deck: [], debug: [], queryClass, bandThreshold: 0, bandSize: 0 };
  }

  const best = pool[0]!.score;
  const bandThreshold = relevanceBandThreshold(best);
  const byId = new Map(pool.map((it) => [it.id, it]));
  const allById = new Map(ranked.map((it) => [it.id, it]));

  const naturalIds = (options.naturalDeckIds ?? []).filter((id) => allById.has(id) || byId.has(id));
  const seedIds =
    naturalIds.length > 0 ? naturalIds.slice(0, deckSize) : pool.slice(0, deckSize).map((it) => it.id);

  const annotate = (item: ExposureRerankItem<T>, bandPeerCount: number) => {
    const strength = relevanceStrength(item);
    const st = snapshot.stores[item.id];
    const top3CountBefore = st?.top3Count ?? 0;
    const sameMenuFamily =
      queryClass === "explicit_menu" && Boolean(st?.fingerprints.includes(fp));
    const { penalty, reasons } = exposurePenalty({
      top3Count: top3CountBefore,
      meanTop3: snapshot.meanTop3,
      strength,
      queryClass,
      sameMenuFamily,
      bandPeerCount,
      hardCap: options.hardCap,
    });
    return { item, strength, penalty, reasons, top3CountBefore, adjusted: item.score - penalty };
  };

  const used = new Set<string>();
  const pickedItems: ExposureRerankItem<T>[] = [];
  const debugRows: Array<ReturnType<typeof annotate> & { finalReasons: ExposurePenaltyReason[] }> = [];

  for (let seedIndex = 0; seedIndex < seedIds.length; seedIndex++) {
    if (pickedItems.length >= deckSize) break;
    const seedId = seedIds[seedIndex]!;
    const laterIds = new Set(seedIds.slice(seedIndex + 1));
    const resolvedSeed = allById.get(seedId) ?? byId.get(seedId);
    if (!resolvedSeed) continue;
    let seed = resolvedSeed;
    if (queryClass !== "explicit_menu" && isBlockedForQuery(seed, ctx, queryClass)) continue;
    if (used.has(seed.id)) {
      const alt = pool.find(
        (it) =>
          !used.has(it.id) &&
          !laterIds.has(it.id) &&
          categoryKey(it.category) === categoryKey(seed.category) &&
          !isBlockedForQuery(it, ctx, queryClass) &&
          it.score >= seed.score - bandThreshold
      );
      if (!alt) continue;
      seed = alt;
    }
    const cat = categoryKey(seed.category);
    const seedHitsQuery = nameQueryTokenHit(seed.name, ctx.query);
    const peers = pool.filter((it) => {
      if (used.has(it.id) || it.id === seed.id || laterIds.has(it.id)) return false;
      if (categoryKey(it.category) !== cat) return false;
      if (isBlockedForQuery(it, ctx, queryClass)) return false;
      if (seedHitsQuery && !nameQueryTokenHit(it.name, ctx.query)) return false;
      return it.score >= seed.score - bandThreshold;
    });
    const seedAnn = annotate(seed, peers.length + 1);
    let chosen = seedAnn;
    const strengthRank = (s: RelevanceStrength) => (s === "STRONG" ? 3 : s === "MEDIUM" ? 2 : 1);
    const canReplace =
      seedAnn.penalty > 0.5 &&
      !(queryClass === "explicit_menu" && seedAnn.strength === "STRONG") &&
      !(queryClass === "discovery" && cat === "restaurant") &&
      peers.length > 0;
    if (canReplace) {
      let bestPeer = seedAnn;
      for (const p of peers) {
        const a = annotate(p, peers.length + 1);
        if (strengthRank(a.strength) < strengthRank(seedAnn.strength)) continue;
        if ((seed.keywordScore ?? 0) - (p.keywordScore ?? 0) >= 12) continue;
        if ((seed.foodIntentScore ?? 0) - (p.foodIntentScore ?? 0) >= 15) continue;
        if (a.adjusted > bestPeer.adjusted + 0.15) bestPeer = a;
      }
      if (bestPeer.item.id !== seed.id) {
        chosen = {
          ...bestPeer,
          reasons: [
            ...new Set<ExposurePenaltyReason>([
              ...bestPeer.reasons,
              "HIGH_CROSS_QUERY_EXPOSURE",
              "SIMILAR_ALTERNATIVES_AVAILABLE",
            ]),
          ],
        };
      }
    }
    if (queryClass !== "explicit_menu" && isBlockedForQuery(chosen.item, ctx, queryClass) && peers.length) {
      chosen = annotate(peers[0]!, peers.length);
    }
    used.add(chosen.item.id);
    pickedItems.push(chosen.item);
    debugRows.push({ ...chosen, finalReasons: chosen.reasons });
  }

  const canFillSlot = (it: ExposureRerankItem<T>) => {
    const cat = categoryKey(it.category);
    if (used.has(it.id)) return false;
    if (isBlockedForQuery(it, ctx, queryClass)) return false;
    if (cat === "salon") return false;
    if (queryClass === "discovery" && cat === "restaurant") return false;
    return it.score >= best - bandThreshold;
  };

  while (pickedItems.length < deckSize) {
    const leftoverNatural = seedIds
      .map((id) => allById.get(id) ?? byId.get(id))
      .find((it) => it && canFillSlot(it));
    const fill =
      leftoverNatural ??
      pool
        .filter(canFillSlot)
        .map((it) => annotate(it, 2))
        .sort((a, b) => b.adjusted - a.adjusted || a.item.id.localeCompare(b.item.id))[0]?.item;
    if (!fill) break;
    used.add(fill.id);
    pickedItems.push(fill);
    debugRows.push({ ...annotate(fill, 2), finalReasons: annotate(fill, 2).reasons });
  }

  if (queryClass === "discovery" && pickedItems.length >= 2) {
    const cats = new Set(pickedItems.map((p) => categoryKey(p.category)));
    if (cats.size === 1 && pickedItems.length === deckSize) {
      const last = pickedItems[pickedItems.length - 1]!;
      const alt = pool.find((it) => {
        const cat = categoryKey(it.category);
        if (used.has(it.id) || isBlockedForQuery(it, ctx, queryClass)) return false;
        if (cat === categoryKey(last.category)) return false;
        if (cat !== "cafe" && cat !== "activity") return false;
        return it.score >= last.score - bandThreshold;
      });
      if (alt) {
        used.delete(last.id);
        used.add(alt.id);
        pickedItems[pickedItems.length - 1] = alt;
        debugRows[debugRows.length - 1] = {
          ...annotate(alt, 3),
          finalReasons: ["DISCOVERY_CATEGORY_SPREAD", "SIMILAR_ALTERNATIVES_AVAILABLE"],
        };
      }
    }
  }

  const deck = pickedItems.slice(0, deckSize);
  const debug: ExposureItemDebug[] = deck.map((item, finalRank) => {
    const row = debugRows[finalRank];
    return {
      storeId: item.id,
      name: item.name,
      baseRankingScore: item.score,
      top3CountBefore: row?.top3CountBefore ?? snapshot.stores[item.id]?.top3Count ?? 0,
      relevance: row?.strength ?? relevanceStrength(item),
      diversityPenalty: row?.penalty ?? 0,
      adjustedScore: row?.adjusted ?? item.score,
      finalRank: finalRank + 1,
      reasons: row?.finalReasons ?? row?.reasons ?? ["NO_PENALTY"],
    };
  });

  return { deck, debug, queryClass, bandThreshold, bandSize: pool.length };
}
