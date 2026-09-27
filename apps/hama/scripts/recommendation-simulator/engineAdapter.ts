import type { HomeCard } from "@/lib/storeTypes";
import type { IntentionType } from "@/lib/intention";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { scenarioObjectToIntention } from "@/lib/scenarioEngine/scenarioRankBridge";
import { buildTopRecommendations, type BuildRecommendationsContext, type ScoredRecommendItem } from "@/lib/recommend/scoring";
import {
  applyExposureRerank,
  buildExposureSnapshot,
  EXPOSURE_POOL_LIMIT,
  queryFingerprint,
  type ExposureItemDebug,
  type ExposureQueryContext,
  type ExposureSnapshot,
} from "@/lib/recommend/exposureRerank";
import { DISCOVERY_POOL_LIMIT, type DiscoveryItemDebug } from "@/lib/recommend/discoveryRole";
import { finalizeDiscoveryPool } from "@/lib/recommend/finalizeRecommendations";
import { cardViolatesHardNegation } from "@/lib/scenarioEngine/negationUnderstanding";
import { ensureCatalogMenuLexicon } from "@/lib/recommend/catalogMenuLexicon";
import { isDirectSearchModeQuery } from "@/lib/search/directSearch";
import { expandSearchQuery } from "@/lib/searchSynonyms";
import { matchNamedFoodPreset } from "@/lib/recommend/namedFoodPresets";
import { categoriesForHomeTab } from "@/lib/storeCategoryFilters";
import type { HomeTabKey } from "@/lib/storeTypes";
import type { UserProfile } from "@/lib/onboardingProfile";
import { DEFAULT_USER_PROFILE } from "@/lib/onboardingProfile";
import {
  KEYWORD_OVERLAP_CAP,
  NAMED_FOOD_PRESET_POOL,
  OSAN_CITY_HALL,
  RECOMMEND_POOL_PER_CATEGORY_MIXED,
  RECOMMEND_POOL_SINGLE_TAB,
} from "./config";
import { compact, dedupeCards, normalizeCategoryKey, sortByUpdatedAtDesc } from "./cardUtils";
import type { CatalogCard, RankedItem, RetrievalMode, SimulationScenario } from "./types";

export type EngineRun = {
  parsed: ScenarioObject;
  intention: IntentionType;
  profile: UserProfile;
  origin: { lat: number; lng: number };
  retrieved: CatalogCard[];
  ranked: RankedItem[];
  scoredPool: RankedItem[];
  retrievalMode: RetrievalMode;
};

function tabCategories(tab: HomeTabKey): string[] | null {
  return categoriesForHomeTab(tab);
}

function cardInCategories(card: CatalogCard, categories: string[] | null): boolean {
  if (!categories || categories.length === 0) return true;
  const raw = String(card.category ?? "").toLowerCase();
  const norm = normalizeCategoryKey(card.category);
  return categories.some((c) => {
    const k = String(c).toLowerCase();
    return raw === k || norm === k || raw.includes(k);
  });
}

function takeUpdated(cards: CatalogCard[], limit: number | null): CatalogCard[] {
  const sorted = sortByUpdatedAtDesc(cards);
  if (limit == null || limit <= 0) return sorted;
  return sorted.slice(0, limit);
}

function tabPool(
  catalog: CatalogCard[],
  tab: HomeTabKey,
  mode: RetrievalMode,
  limitOverride?: number
): CatalogCard[] {
  const cats = tabCategories(tab);
  const matched = catalog.filter((c) => cardInCategories(c, cats));
  if (mode === "full_catalog") return matched;
  const limit = limitOverride ?? (tab === "all" ? undefined : RECOMMEND_POOL_SINGLE_TAB);
  if (tab === "all") {
    const per = RECOMMEND_POOL_PER_CATEGORY_MIXED;
    const parts: CatalogCard[] = [];
    for (const t of ["restaurant", "cafe", "salon", "activity"] as HomeTabKey[]) {
      parts.push(...tabPool(catalog, t, "current", per));
    }
    return dedupeCards(parts);
  }
  return takeUpdated(matched, limit ?? RECOMMEND_POOL_SINGLE_TAB);
}

function resolveTab(parsed: ScenarioObject): HomeTabKey {
  if (parsed.intentType === "search_strict" && parsed.intentCategory) {
    switch (parsed.intentCategory) {
      case "FOOD":
        return "restaurant";
      case "CAFE":
        return "cafe";
      case "BEAUTY":
        return "salon";
      case "ACTIVITY":
        return "activity";
      case "FITNESS":
        return "fitness";
      case "LIFE":
        return "life";
      default:
        return "all";
    }
  }
  return "all";
}

function nameMatchHit(card: CatalogCard, query: string): boolean {
  const n = compact(card.name);
  const q = compact(query);
  if (!n || !q || q.length < 2) return false;
  if (n === q || n.startsWith(q) || n.includes(q)) return true;
  const parts = query
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length >= 2);
  if (parts.length >= 2 && parts.every((p) => n.includes(compact(p)))) return true;
  return false;
}

function arrayOverlap(values: string[] | undefined, terms: string[]): boolean {
  if (!values?.length || !terms.length) return false;
  const hay = values.map((v) => compact(v)).filter(Boolean);
  return terms.some((t) => {
    const ct = compact(t);
    if (ct.length < 2) return false;
    return hay.some((h) => h === ct || h.includes(ct) || ct.includes(h));
  });
}

function keywordOverlapHits(catalog: CatalogCard[], query: string, cap: number | null): CatalogCard[] {
  const terms = expandSearchQuery(query);
  const hits = catalog.filter(
    (c) => arrayOverlap(c.menu_keywords, terms) || arrayOverlap(c.search_keywords, terms)
  );
  const sorted = sortByUpdatedAtDesc(hits);
  if (cap == null) return sorted;
  return sorted.slice(0, cap);
}

/**
 * In-memory recreation of production retrieval:
 * - tab fetch ordered by updated_at DESC with LIMIT 120 (or mixed 55×4)
 * - direct search: name match + menu/search keyword overlap (cap 200) merged in
 * - named food preset: restaurant pool up to 420
 * FULL CATALOG skips the numeric caps but keeps the same category/keyword predicates.
 */
export function retrieveCandidates(
  catalog: CatalogCard[],
  parsed: ScenarioObject,
  query: string,
  mode: RetrievalMode
): CatalogCard[] {
  const neg = parsed.queryUnderstanding?.negation;
  const retrievalQuery =
    neg?.isNegationQuery && String(neg.positiveRemainder ?? "").trim()
      ? String(neg.positiveRemainder).trim()
      : query;

  let tab = resolveTab(parsed);
  if (neg?.excludedCategories.includes("cafe") && tab === "cafe") tab = "all";
  if (neg?.excludedCategories.includes("restaurant") && tab === "restaurant") tab = "all";

  let namedPreset = matchNamedFoodPreset(retrievalQuery);
  if (namedPreset && (neg?.excludedCategories.includes("restaurant") || neg?.excludedMenus.includes("고기"))) {
    namedPreset = null;
  }
  const direct = isDirectSearchModeQuery(retrievalQuery);

  let pool: CatalogCard[];
  if (namedPreset) {
    const restaurants = catalog.filter((c) => normalizeCategoryKey(c.category) === "restaurant");
    pool =
      mode === "full_catalog"
        ? restaurants
        : takeUpdated(restaurants, NAMED_FOOD_PRESET_POOL);
  } else {
    pool = tabPool(catalog, tab, mode);
  }

  const purposes = new Set(neg?.isNegationQuery ? (neg.positivePurpose ?? []) : []);
  if (purposes.has("FAMILY") || purposes.has("PLAY")) {
    pool = dedupeCards([...pool, ...tabPool(catalog, "activity", mode)]);
  }
  if (purposes.has("CAFE") && !neg?.excludedCategories.includes("cafe") && !neg?.suppressedIntents.includes("CAFE")) {
    pool = dedupeCards([...pool, ...tabPool(catalog, "cafe", mode)]);
  }

  if (direct || namedPreset) {
    const nameHits = catalog.filter((c) => nameMatchHit(c, retrievalQuery));
    const kwCap = mode === "full_catalog" ? null : KEYWORD_OVERLAP_CAP;
    const kwHits = keywordOverlapHits(catalog, retrievalQuery, kwCap);
    pool = dedupeCards([...nameHits, ...kwHits, ...pool]);
  }

  const catalogMenuTerms = [
    parsed.catalogMenu?.catalogMenuPrimary,
    ...(parsed.catalogMenu?.catalogMenuSecondary ?? []),
  ].filter((t): t is string => Boolean(t));
  const uniqueTerms = [...new Set(catalogMenuTerms)];
  if (uniqueTerms.length) {
    const kwCap = mode === "full_catalog" ? null : KEYWORD_OVERLAP_CAP;
    for (const term of uniqueTerms) {
      const nameHits = catalog.filter((c) => nameMatchHit(c, term));
      const kwHits = keywordOverlapHits(catalog, term, kwCap);
      pool = dedupeCards([...nameHits, ...kwHits, ...pool]);
    }
  }

  if (neg?.isNegationQuery) {
    const kept = pool.filter((c) => !cardViolatesHardNegation(c as HomeCard, neg));
    if (kept.length === 0) {
      const mixed = tabPool(catalog, "all", mode).filter((c) => !cardViolatesHardNegation(c as HomeCard, neg));
      if (mixed.length) {
        neg.fallbackReason = "mixed_pool_after_hard_exclusion";
        pool = mixed;
      } else {
        neg.fallbackReason = "hard_exclusion_no_safe_candidates";
        pool = kept;
      }
    } else {
      pool = kept;
    }
  }

  return pool;
}

export function personaToProfile(scenario: SimulationScenario): UserProfile {
  const p = scenario.persona;
  const companions: UserProfile["companions"] = [];
  if (p?.familyType === "family_with_kids" || p?.children) companions.push("가족");
  else if (p?.familyType === "couple") companions.push("둘이서");
  else if (p?.familyType === "friends") companions.push("친구");
  else if (p?.familyType === "solo") companions.push("혼자");
  else if (p?.familyType === "parents") companions.push("가족");

  const dietary: UserProfile["dietary_restrictions"] = ["없음"];
  if (scenario.tags.includes("vegetarian") || scenario.tags.includes("채식")) {
    dietary[0] = "채식";
  }

  return {
    ...DEFAULT_USER_PROFILE,
    companions,
    young_child: p?.children ? "있음" : "없음",
    dietary_restrictions: dietary,
    onboarding_completed_at: "simulator",
  };
}

export function originFromScenario(scenario: SimulationScenario): { lat: number; lng: number } {
  if (typeof scenario.context?.lat === "number" && typeof scenario.context?.lng === "number") {
    return { lat: scenario.context.lat, lng: scenario.context.lng };
  }
  if (scenario.context?.location === "dongtan") {
    return { lat: 37.2009, lng: 127.0957 };
  }
  return { lat: OSAN_CITY_HALL.lat, lng: OSAN_CITY_HALL.lng };
}

function toRanked(s: ScoredRecommendItem): RankedItem {
  return {
    id: s.card.id,
    name: s.card.name,
    category: s.card.category,
    distanceKm: s.card.distanceKm ?? null,
    finalScore: s.breakdown.finalScore,
    breakdown: s.breakdown,
    tags: s.card.tags,
    withKids: s.card.with_kids ?? null,
    description: s.card.description ?? null,
    searchKeywords: s.card.search_keywords,
  };
}

export function exposureContextFromParsed(parsed: ScenarioObject, query: string): ExposureQueryContext {
  return {
    query,
    intentType: parsed.intentType,
    intentCategory: parsed.intentCategory,
    scenario: parsed.scenario,
    menuIntent: parsed.menuIntent,
    route: parsed.queryUnderstanding?.route ?? parsed.intentCategory ?? "MIXED",
  };
}

export function applyDiscoveryToEngineRun(run: EngineRun, query: string): DiscoveryItemDebug[] {
  const toItem = (r: RankedItem) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    score: r.finalScore ?? 0,
    tags: r.tags,
    mood: undefined,
    withKids: r.withKids ?? null,
    description: r.description ?? null,
    searchKeywords: r.searchKeywords,
    payload: r,
  });
  const result = finalizeDiscoveryPool({
    query,
    parsed: run.parsed,
    ranked: run.ranked.map(toItem),
    scoredPool: run.scoredPool.map(toItem),
    deckSize: 3,
  });
  if (!result.applied) return result.debug;
  const byId = new Map<string, RankedItem>();
  for (const r of run.ranked) byId.set(r.id, r);
  for (const r of run.scoredPool) if (!byId.has(r.id)) byId.set(r.id, r);
  run.ranked = result.deck.map((d) => {
    const src = byId.get(d.id) ?? d.payload;
    return {
      ...src,
      discoveryDebug: result.debug.find((x) => x.storeId === d.id),
    };
  });
  return result.debug;
}

export function rerankEngineDeck(
  run: EngineRun,
  snapshot: ExposureSnapshot,
  query: string,
  hardCap?: number | null
): { ranked: RankedItem[]; exposureDebug: ExposureItemDebug[] } {
  const ctx = exposureContextFromParsed(run.parsed, query);
  const merged = new Map<string, RankedItem>();
  for (const r of run.ranked) merged.set(r.id, r);
  for (const r of run.scoredPool) if (!merged.has(r.id)) merged.set(r.id, r);
  const poolSource = [...merged.values()];
  const items = poolSource.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    score: r.finalScore ?? 0,
    menuTier: r.breakdown?.menuTier ?? "none",
    foodIntentScore: r.breakdown?.foodIntentScore ?? 0,
    keywordScore: r.breakdown?.keywordScore ?? 0,
    payload: r,
  }));
  const result = applyExposureRerank(items, ctx, snapshot, {
    deckSize: 3,
    poolLimit: EXPOSURE_POOL_LIMIT,
    hardCap,
    naturalDeckIds: run.ranked.map((r) => r.id),
  });
  const byId = new Map(poolSource.map((r) => [r.id, r]));
  const ranked = result.deck.map((d) => {
    const src = byId.get(d.id) ?? d.payload;
    return {
      ...src,
      exposureDebug: result.debug.find((x) => x.storeId === d.id),
    };
  });
  return { ranked, exposureDebug: result.debug };
}

export function snapshotFromEngineRuns(runs: EngineRun[], queries: string[]): ExposureSnapshot {
  const decks = runs.map((r) => r.ranked.map((d) => ({ id: d.id })));
  const fingerprints = runs.map((r, i) => queryFingerprint(exposureContextFromParsed(r.parsed, queries[i] ?? "")));
  return buildExposureSnapshot(decks, fingerprints);
}

export function runEngine(
  catalog: CatalogCard[],
  scenario: SimulationScenario,
  mode: RetrievalMode
): EngineRun {
  ensureCatalogMenuLexicon(catalog);
  const parsed = parseScenarioIntent(scenario.query);
  const intention = scenarioObjectToIntention(parsed);
  const profile = personaToProfile(scenario);
  const origin = originFromScenario(scenario);
  const neg = parsed.queryUnderstanding?.negation;
  const searchQuery =
    neg?.isNegationQuery && String(neg.positiveRemainder ?? "").trim()
      ? String(neg.positiveRemainder).trim()
      : scenario.query;
  const retrieved = retrieveCandidates(catalog, parsed, scenario.query, mode);

  let scoredPoolRaw: ScoredRecommendItem[] = [];
  const ctx: BuildRecommendationsContext = {
    intent: intention,
    userLat: origin.lat,
    userLng: origin.lng,
    searchQuery,
    scenarioObject: parsed,
    userProfile: profile,
    attachScoredPool: (scored) => {
      const head = scored.slice(0, Math.max(EXPOSURE_POOL_LIMIT, DISCOVERY_POOL_LIMIT));
      const extra = scored.filter((s) => {
        const c = String(s.card.category ?? "").toLowerCase();
        return c === "activity" || c === "library";
      });
      const seen = new Set<string>();
      scoredPoolRaw = [];
      for (const s of [...head, ...extra]) {
        if (seen.has(s.card.id)) continue;
        seen.add(s.card.id);
        scoredPoolRaw.push(s);
      }
    },
  };

  const scored = buildTopRecommendations(retrieved as HomeCard[], ctx);
  const ranked: RankedItem[] = scored.map(toRanked);
  const scoredPool: RankedItem[] = scoredPoolRaw.map(toRanked);

  return {
    parsed,
    intention,
    profile,
    origin,
    retrieved,
    ranked,
    scoredPool,
    retrievalMode: mode,
  };
}
