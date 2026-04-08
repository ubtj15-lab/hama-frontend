import type { HomeCard } from "@/lib/storeTypes";
import type { IntentionType } from "@/lib/intention";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { storeCategoryMatchesIntentCategory } from "@/lib/scenarioEngine/intentClassification";
import { resolveScenarioConfig } from "@/lib/scenarioEngine/resolveScenarioConfig";
import { configTagBoostRaw, placeTypePreferenceRaw } from "@/lib/scenarioEngine/scoringBoost";
import { scenarioObjectToIntention, scenarioTypeToRankKey } from "@/lib/scenarioEngine/scenarioRankBridge";
import { logScenarioEngineDebug } from "@/lib/scenarioEngine/scenarioDebug";
import {
  WEIGHT_BONUS,
  WEIGHT_BUSINESS,
  WEIGHT_DISTANCE,
  WEIGHT_FOOD_INTENT,
  WEIGHT_COMPOSITE,
  WEIGHT_KEYWORD,
  WEIGHT_QUALITY,
  WEIGHT_SCENARIO,
  RECOMMEND_DECK_SIZE,
  DIVERSITY_PENALTY_SAME_BRAND,
  DIVERSITY_PENALTY_SAME_MAIN_CATEGORY,
  DIVERSITY_PENALTY_SAME_SUB_CATEGORY,
} from "./recommendConstants";
import {
  cardMatchesStrictFoodIntent,
  filterFoodCandidatesByMenuIntent,
  foodMenuMatchNormalized,
  inferPlaceFoodSub,
} from "./foodIntentRanking";
import { compositeIntentRawScore, violatesHardConstraints } from "./compositeRanking";
import { buildCompositeTagsForCard } from "@/lib/scenarioEngine/compositeIntent";
import { buildFoodTagsForCard } from "@/lib/scenarioEngine/foodIntent";
import { dedupeTags } from "./recommendationBadge";
import {
  SCENARIO_RAW_CAP,
  SCENARIO_TAG_RULES,
  intentionToScenarioKey,
  scenarioCategoryBonusMax,
  type RecommendScenarioKey,
} from "./scenarioWeights";
import {
  bonusScoreFromCard,
  businessStateFromCard,
  businessScoreFromState,
  distanceScoreFromKm,
  keywordScoreFromQuery,
  qualityScoreFromCard,
  type BusinessState,
} from "./scoreParts";
import { buildHomeRecommendationReason } from "./reasonPhrases";
import diversityHints from "./diversityHints.json";
import { buildRecommendationBadge, inferScenarioForBadgeWhenNeutral } from "./recommendationBadge";

export type RecommendScoreBreakdown = {
  distanceScore: number;
  scenarioScore: number;
  businessScore: number;
  qualityScore: number;
  keywordScore: number;
  bonusScore: number;
  foodIntentScore: number;
  compositeScore: number;
  scenarioRaw: number;
  finalScore: number;
  businessState: BusinessState;
  activeScenario: RecommendScenarioKey;
};

export type ScoredRecommendItem = {
  card: HomeCard;
  reasonText: string;
  reasonVoice: RecommendScenarioKey;
  breakdown: RecommendScoreBreakdown;
};

export type BuildRecommendationsContext = {
  intent: IntentionType;
  userLat?: number | null;
  userLng?: number | null;
  excludeStoreIds?: string[];
  /** Home search box text; low-weight keyword score */
  searchQuery?: string | null;
  /** Parsed scenario from natural language (ranking, badges) */
  scenarioObject?: ScenarioObject | null;
};

function normBlob(card: HomeCard): string {
  const c = card as any;
  const parts: string[] = [];
  if (c?.name) parts.push(String(c.name));
  if (c?.category) parts.push(String(c.category));
  if (c?.address) parts.push(String(c.address));
  if (Array.isArray(c?.tags)) parts.push(c.tags.join(" "));
  if (Array.isArray(c?.mood)) parts.push(c.mood.join(" "));
  if (c?.moodText) parts.push(String(c.moodText));
  if (typeof c?.description === "string") parts.push(c.description);
  if (Array.isArray(c?.menu_keywords)) parts.push(c.menu_keywords.join(" "));
  return parts
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normCompactBlobStr(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function distanceKmToCard(card: HomeCard, ctx: BuildRecommendationsContext): number | null {
  const lat = typeof card.lat === "number" ? card.lat : null;
  const lng = typeof card.lng === "number" ? card.lng : null;
  if (lat == null || lng == null) return null;
  if (ctx.userLat == null || ctx.userLng == null) return null;
  return haversineKm({ lat: ctx.userLat, lng: ctx.userLng }, { lat, lng });
}

function scenarioRawForKey(blob: string, key: RecommendScenarioKey, card: HomeCard): number {
  let sum = 0;
  for (const rule of SCENARIO_TAG_RULES[key]) {
    if (rule.patterns.some((re) => re.test(blob))) sum += rule.weight;
  }
  sum += scenarioCategoryBonusMax(blob, key);
  const c = card as any;
  if (key === "family" && c?.with_kids === true) sum += 20;
  if (key === "solo" && c?.for_work === true) sum += 12;
  if (key === "group" && c?.reservation_required === true) sum += 14;
  return sum;
}

function scenarioNormFromRaw(raw: number, key: RecommendScenarioKey): number {
  const cap = SCENARIO_RAW_CAP[key] || 1;
  return Math.min(100, (raw / cap) * 100);
}

function pickActiveScenario(
  card: HomeCard,
  intent: IntentionType,
  blob: string
): { key: RecommendScenarioKey; raw: number; norm: number } {
  const fixed = intentionToScenarioKey(intent);
  if (fixed !== "neutral") {
    const raw = scenarioRawForKey(blob, fixed, card);
    return { key: fixed, raw, norm: scenarioNormFromRaw(raw, fixed) };
  }
  const keys: RecommendScenarioKey[] = ["date", "family", "solo", "group"];
  let bestK: RecommendScenarioKey = "solo";
  let bestRaw = -1;
  for (const k of keys) {
    const raw = scenarioRawForKey(blob, k, card);
    if (raw > bestRaw) {
      bestRaw = raw;
      bestK = k;
    }
  }
  if (bestRaw <= 0) {
    const cat = String(card.category ?? "").toLowerCase();
    if (cat === "cafe" || cat === "activity") bestK = "date";
    else if (cat === "salon") bestK = "solo";
    else if (cat === "restaurant") bestK = "group";
    else bestK = "date";
    const raw = scenarioRawForKey(blob, bestK, card);
    return { key: bestK, raw, norm: scenarioNormFromRaw(raw, bestK) };
  }
  return { key: bestK, raw: bestRaw, norm: scenarioNormFromRaw(bestRaw, bestK) };
}

function mainCategoryKey(card: HomeCard): string {
  return String(card.category ?? "unknown").toLowerCase();
}

const SUB_CATEGORY_KEYS = ["korean", "japanese", "chinese", "western", "meat", "drink"] as const;

function inferSubCategory(blob: string): string | null {
  const map = diversityHints.subCategoryKeywords;
  for (const key of SUB_CATEGORY_KEYS) {
    const words = map[key];
    if (words.some((w) => blob.includes(w))) return key;
  }
  if (/\bbar\b/i.test(blob)) return "drink";
  return null;
}

const KNOWN_BRAND_PREFIX = new Set(diversityHints.knownBrandPrefixes);

function brandKey(card: HomeCard): string | null {
  const name = String(card.name ?? "").trim();
  const first = name.split(/[\s|,.]+/)[0] ?? "";
  if (first.length < 2) return null;
  if (KNOWN_BRAND_PREFIX.has(first)) return first;
  return null;
}

function diversityPenalty(item: ScoredRecommendItem, picked: ScoredRecommendItem[]): number {
  let p = 0;
  const m1 = mainCategoryKey(item.card);
  const s1 = inferSubCategory(normBlob(item.card));
  const b1 = brandKey(item.card);
  for (const o of picked) {
    if (mainCategoryKey(o.card) === m1) p += DIVERSITY_PENALTY_SAME_MAIN_CATEGORY;
    const s2 = inferSubCategory(normBlob(o.card));
    if (s1 && s2 && s1 === s2) p += DIVERSITY_PENALTY_SAME_SUB_CATEGORY;
    const b2 = brandKey(o.card);
    if (b1 && b2 && b1 === b2) p += DIVERSITY_PENALTY_SAME_BRAND;
  }
  return p;
}

function selectWithDiversity(sorted: ScoredRecommendItem[], limit: number): ScoredRecommendItem[] {
  const pool = [...sorted];
  const picked: ScoredRecommendItem[] = [];
  while (picked.length < limit && pool.length) {
    let bestI = 0;
    let bestEff = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const eff = pool[i]!.breakdown.finalScore - diversityPenalty(pool[i]!, picked);
      if (eff > bestEff) {
        bestEff = eff;
        bestI = i;
      }
    }
    picked.push(pool.splice(bestI, 1)[0]!);
  }
  return picked;
}

export function buildTopRecommendations(
  candidates: HomeCard[],
  ctx: BuildRecommendationsContext
): ScoredRecommendItem[] {
  const exclude = new Set((ctx.excludeStoreIds ?? []).filter(Boolean));

  const so = ctx.scenarioObject;
  const strictFood =
    so?.intentType === "search_strict" &&
    so.intentCategory === "FOOD" &&
    so.intentStrict !== false;

  let pool = candidates;
  if (strictFood && so) {
    pool = filterFoodCandidatesByMenuIntent(candidates, so);
  }

  const runPass = (relaxed: boolean): ScoredRecommendItem[] => {
    const out: ScoredRecommendItem[] = [];
    for (const card of pool) {
      if (exclude.has(card.id)) continue;

      const strict = ctx.scenarioObject;
      if (
        strict?.intentType === "search_strict" &&
        strict.intentCategory &&
        strict.intentStrict !== false &&
        !storeCategoryMatchesIntentCategory(card, strict.intentCategory)
      ) {
        continue;
      }

      if (strictFood && so && !cardMatchesStrictFoodIntent(card, so)) {
        continue;
      }

      if (
        !relaxed &&
        strict?.intentType === "search_strict" &&
        strict.hardConstraints?.length &&
        violatesHardConstraints(card, strict)
      ) {
        continue;
      }

      const businessState = businessStateFromCard(card);
      if (!relaxed && businessState === "CLOSED") continue;

      const blob = normBlob(card);
      const km = distanceKmToCard(card, ctx);

      if (!relaxed && strict?.conversationExcludeMenuTerms?.length) {
        const blobC = normCompactBlobStr(blob);
        let skipMenu = false;
        for (const term of strict.conversationExcludeMenuTerms) {
          const t = normCompactBlobStr(term);
          if (t.length >= 2 && blobC.includes(t)) {
            skipMenu = true;
            break;
          }
        }
        if (skipMenu) continue;
      }

      if (!relaxed && strict?.conversationRejectedFoodSubs?.length) {
        const ps = inferPlaceFoodSub(card);
        if (ps && strict.conversationRejectedFoodSubs.includes(ps)) continue;
      }

    let distS = distanceScoreFromKm(km);
    if (strict?.distanceTolerance === "near_only" && km != null && Number.isFinite(km)) {
      if (km > 1.2) distS *= Math.max(0.2, 1 - (km - 1.2) * 0.42);
      if (km > 3.5) distS *= 0.55;
    }
    const scenarioCfg = ctx.scenarioObject ? resolveScenarioConfig(ctx.scenarioObject) : null;
    const rankKeyFromObj = ctx.scenarioObject ? scenarioTypeToRankKey(ctx.scenarioObject.scenario) : null;

    let activeScenario: RecommendScenarioKey;
    let scenarioS: number;
    let rawScenario: number;

    if (rankKeyFromObj && scenarioCfg) {
      activeScenario = rankKeyFromObj;
      const boost = configTagBoostRaw(blob, scenarioCfg);
      const typeFit = placeTypePreferenceRaw(card, scenarioCfg);
      rawScenario = scenarioRawForKey(blob, rankKeyFromObj, card) + boost + typeFit;
      const cap = (SCENARIO_RAW_CAP[rankKeyFromObj] || 1) + 55;
      scenarioS = Math.min(100, (rawScenario / cap) * 100);
    } else {
      const picked = pickActiveScenario(card, ctx.intent, blob);
      activeScenario = picked.key;
      scenarioS = picked.norm;
      rawScenario = scenarioRawForKey(blob, activeScenario, card);
    }

    const userScenarioKey = intentionToScenarioKey(ctx.intent);
    const voiceForContent = ctx.scenarioObject
      ? scenarioTypeToRankKey(ctx.scenarioObject.scenario)
      : userScenarioKey !== "neutral"
        ? userScenarioKey
        : activeScenario;

    const legacyIntent = ctx.scenarioObject ? scenarioObjectToIntention(ctx.scenarioObject) : ctx.intent;

    const bizS = businessScoreFromState(businessState);
    const qualS = qualityScoreFromCard(card);
    const kwS = keywordScoreFromQuery(ctx.searchQuery, card, blob);
    const bonS = bonusScoreFromCard(card, blob);

    const useFoodRanking =
      strictFood &&
      so &&
      ((so.menuIntent?.length ?? 0) > 0 || so.foodSubCategory != null);
    const foodS = useFoodRanking
      ? foodMenuMatchNormalized(card, so.menuIntent, so.foodSubCategory)
      : 0;

    const useComposite =
      !!so &&
      ((so.foodPreference?.length ?? 0) > 0 ||
        (so.vibePreference?.length ?? 0) > 0 ||
        (so.softConstraints?.length ?? 0) > 0 ||
        so.timeOfDay != null ||
        (so.hardConstraints?.length ?? 0) > 0 ||
        so.distanceTolerance != null ||
        so.parkingPreferred === true ||
        (so.scenario !== "generic" && so.scenario !== "friends"));

    const compS = useComposite ? compositeIntentRawScore(card, so) : 0;

    const finalScore =
      distS * WEIGHT_DISTANCE +
      scenarioS * WEIGHT_SCENARIO +
      bizS * WEIGHT_BUSINESS +
      qualS * WEIGHT_QUALITY +
      kwS * WEIGHT_KEYWORD +
      bonS * WEIGHT_BONUS +
      foodS * (useFoodRanking ? WEIGHT_FOOD_INTENT : 0) +
      compS * (useComposite ? WEIGHT_COMPOSITE : 0);

    const breakdown: RecommendScoreBreakdown = {
      distanceScore: distS,
      scenarioScore: scenarioS,
      businessScore: bizS,
      qualityScore: qualS,
      keywordScore: kwS,
      bonusScore: bonS,
      foodIntentScore: foodS,
      compositeScore: compS,
      scenarioRaw: rawScenario,
      finalScore,
      businessState,
      activeScenario,
    };

    const reasonText = buildHomeRecommendationReason({
      voice: voiceForContent,
      intent: legacyIntent,
      business: businessState,
      km,
      blob,
      withKids: (card as any).with_kids === true,
      category: card.category,
    });

    const foodExtras =
      strictFood &&
      ctx.scenarioObject &&
      cardMatchesStrictFoodIntent(card, ctx.scenarioObject)
        ? buildFoodTagsForCard(ctx.scenarioObject)
        : [];
    const compositeExtras = ctx.scenarioObject
      ? buildCompositeTagsForCard(ctx.scenarioObject)
      : [];
    const badgeExtras = dedupeTags([...foodExtras, ...compositeExtras]).slice(0, 5);

    const recommendBadge =
      ctx.scenarioObject && scenarioCfg
        ? buildRecommendationBadge(card, {
            blob,
            businessState,
            distanceKm: km,
            explicitScenario: rankKeyFromObj!,
            primaryLabelOverride: scenarioCfg.primaryBadgeLabel,
            ...(badgeExtras.length ? { extraShortTags: badgeExtras } : {}),
          })
        : buildRecommendationBadge(card, {
            blob,
            businessState,
            distanceKm: km,
            ...(badgeExtras.length ? { extraShortTags: badgeExtras } : {}),
            ...(userScenarioKey !== "neutral"
              ? { explicitScenario: userScenarioKey }
              : { neutralInference: inferScenarioForBadgeWhenNeutral(card, blob) }),
          });

    const withDist: HomeCard = {
      ...card,
      distanceKm: km ?? card.distanceKm,
      reasonText,
      recommendBadge,
    };

      out.push({
        card: withDist,
        reasonText,
        reasonVoice: voiceForContent,
        breakdown,
      });
    }
    return out;
  };

  let scored = runPass(false);
  if (scored.length === 0 && pool.length > 0) {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
      console.warn("[buildTopRecommendations] strict pass produced 0 cards; using relaxed pass");
    }
    scored = runPass(true);
  }

  scored.sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore);

  logScenarioEngineDebug({
    parsed: ctx.scenarioObject ?? undefined,
    configKey: ctx.scenarioObject?.scenario,
    rankSamples: scored.slice(0, 4).map((s) => ({
      storeId: s.card.id,
      name: s.card.name,
      scoreBreakdown: {
        final: s.breakdown.finalScore,
        scenario: s.breakdown.scenarioScore,
        distance: s.breakdown.distanceScore,
      },
    })),
  });

  return selectWithDiversity(scored, RECOMMEND_DECK_SIZE);
}

/** strict 시나리오 랭킹 — 내부적으로 buildTopRecommendations와 동일 */
export function rankPlacesForScenario(
  candidates: HomeCard[],
  ctx: BuildRecommendationsContext
): ScoredRecommendItem[] {
  return buildTopRecommendations(candidates, ctx);
}
