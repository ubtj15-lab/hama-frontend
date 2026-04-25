import type { HomeCard } from "@/lib/storeTypes";
import type { IntentionType } from "@/lib/intention";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { storeCategoryMatchesIntentCategory } from "@/lib/scenarioEngine/intentClassification";
import { resolveScenarioConfig } from "@/lib/scenarioEngine/resolveScenarioConfig";
import { configTagBoostRaw, placeTypePreferenceRaw } from "@/lib/scenarioEngine/scoringBoost";
import { scenarioObjectToIntention, scenarioTypeToRankKey } from "@/lib/scenarioEngine/scenarioRankBridge";
import { logScenarioEngineDebug } from "@/lib/scenarioEngine/scenarioDebug";
import {
  WEIGHT_FOOD_INTENT,
  WEIGHT_COMPOSITE,
  RECOMMEND_DECK_SIZE,
  DIVERSITY_PENALTY_SAME_BRAND,
  DIVERSITY_PENALTY_SAME_MAIN_CATEGORY,
  DIVERSITY_PENALTY_SAME_SUB_CATEGORY,
  DIVERSITY_PENALTY_SAME_SCENARIO_VOICE,
} from "./recommendConstants";
import { computeScenarioForcedRawDelta, convenienceScoreFromParts } from "./scenarioForcedRules";
import { distanceBlendForScenarioFit } from "./scenarioRiskAndFit";
import { pickDeckWithBackupRoles } from "./recommendationDeckRoles";
import { behaviorBoostVisibilityFactor, normalizeBehaviorRawToScore } from "./learnedBoostModel";
import { getGlobalImpressionCount, getPersonalizationHints, getPlaceBehaviorRaw } from "./behaviorSignalStore";
import { personalizationFitScore } from "./personalizationFromSignals";
import { computeHybridRecommendationFinal } from "./finalRecommendationScore";
import { enrichBlobForScenarioScoring, hasExplicitFamilySignalsInBlob } from "./enrichScenarioBlob";
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
  ratingScoreFromCard,
  type BusinessState,
} from "./scoreParts";
import { buildHomeRecommendationReason } from "./reasonPhrases";
import diversityHints from "./diversityHints.json";
import { buildRecommendationBadge, inferScenarioForBadgeWhenNeutral } from "./recommendationBadge";
import {
  isCategoryAllowedForScenarioStrict,
  isCategoryAllowedRelaxed,
  isHardExcludedNonPoi,
  normalizeCategory,
} from "./scenarioCategoryRules";
import {
  childFriendlyScore,
  isHardExcludedForKidsScenario,
  shouldBlockKidFriendlyMessaging,
} from "./childFriendlyScore";
import {
  isDrinkOnlyCafeCard,
  shouldExcludeDrinkOnlyForScenarioRanking,
} from "./mealContextSignals";

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
  /** 룰 기반 시나리오 가산·감산 반영 후 블렌드 점수 */
  scenarioRichScore: number;
  convenienceScore: number;
  behaviorBoostPillar: number;
  behaviorVisibility: number;
  personalizationScore: number;
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

/** 데이트 시나리오 랭킹: 가족·혼밥·회식 느낌이 강하면 감점(텍스트 휴리스틱) */
function dateScenarioMismatchPenalty(blob: string): number {
  let pen = 0;
  if (/아이동반|키즈존|키즈룸|유아(?:의자)?|어린이\s*식당|가족\s*단위|가족\s*식당|키즈\s*환영|아이\s*환영/.test(blob)) pen += 28;
  if (/혼밥|1인\s*석|혼자\s*식사|카운터\s*좌석|빠른\s*회전|회전\s*빠름/.test(blob)) pen += 22;
  if (/회식|단체\s*모임|단체\s*전문|야유회|포장마차\s*회식/.test(blob)) pen += 18;
  if (/푸드코트|food\s*court/i.test(blob)) pen += 12;
  if (/시끄|북적|웅성|떠들|빠른\s*회전|회전\s*빠름/.test(blob)) pen += 16;
  return pen;
}

function scenarioRawForKey(blob: string, key: RecommendScenarioKey, card: HomeCard): number {
  let sum = 0;
  for (const rule of SCENARIO_TAG_RULES[key]) {
    if (rule.patterns.some((re) => re.test(blob))) sum += rule.weight;
  }
  sum += scenarioCategoryBonusMax(blob, key);
  const c = card as any;
  if (key === "family" && c?.with_kids === true && hasExplicitFamilySignalsInBlob(blob)) sum += 9;
  else if (key === "family" && c?.with_kids === true) sum += 2;
  if (key === "solo" && c?.for_work === true) sum += 14;
  if (key === "group" && c?.reservation_required === true) sum += 14;

  if (key === "date") {
    sum += dateScenarioMismatchPenalty(blob);
  }

  if (key === "family" && !hasExplicitFamilySignalsInBlob(blob) && c?.with_kids !== true) {
    sum *= 0.52;
  } else if (key === "family" && !hasExplicitFamilySignalsInBlob(blob) && c?.with_kids === true) {
    sum *= 0.72;
  }
  return Math.max(0, sum);
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
  const v1 = item.reasonVoice;
  for (const o of picked) {
    if (mainCategoryKey(o.card) === m1) p += DIVERSITY_PENALTY_SAME_MAIN_CATEGORY;
    const s2 = inferSubCategory(normBlob(o.card));
    if (s1 && s2 && s1 === s2) p += DIVERSITY_PENALTY_SAME_SUB_CATEGORY;
    const b2 = brandKey(o.card);
    if (b1 && b2 && b1 === b2) p += DIVERSITY_PENALTY_SAME_BRAND;
    if (v1 && o.reasonVoice === v1) p += DIVERSITY_PENALTY_SAME_SCENARIO_VOICE;
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

/** 시나리오 객체·의도 → 카테고리 필터 축 */
function resolveRankKeyForCategoryFilter(ctx: BuildRecommendationsContext): RecommendScenarioKey | "neutral" {
  const so = ctx.scenarioObject;
  if (so) {
    if (so.scenario === "generic") return "neutral";
    return scenarioTypeToRankKey(so.scenario);
  }
  const k = intentionToScenarioKey(ctx.intent);
  if (k === "neutral") return "neutral";
  return k as RecommendScenarioKey;
}

export function buildTopRecommendations(
  candidates: HomeCard[],
  ctx: BuildRecommendationsContext
): ScoredRecommendItem[] {
  const exclude = new Set((ctx.excludeStoreIds ?? []).filter(Boolean));
  const rankKeyForCategory = resolveRankKeyForCategoryFilter(ctx);

  const so = ctx.scenarioObject;
  /** 단일 목적 검색(음식·카페·액티비티·미용) — 시나리오별 허용 업종 대신 intentCategory 매칭만 사용 */
  const strictIntentCategorySearch = Boolean(so?.intentType === "search_strict" && so.intentCategory);
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

      if (strictIntentCategorySearch) {
        if (isHardExcludedNonPoi(card)) continue;
      } else if (relaxed) {
        if (!isCategoryAllowedRelaxed(card, false)) continue;
      } else if (!isCategoryAllowedForScenarioStrict(card, rankKeyForCategory)) {
        continue;
      }

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
        strict &&
        !relaxed &&
        (strict.scenario === "family" ||
          strict.scenario === "family_kids" ||
          strict.scenario === "parent_child_outing")
      ) {
        if (isHardExcludedForKidsScenario(card)) continue;
        const cat = normalizeCategory(card);
        if (
          (cat === "restaurant" || cat === "cafe") &&
          childFriendlyScore(card) < 0.28
        ) {
          continue;
        }
      }

      const rankKeyFromObjEarly = ctx.scenarioObject ? scenarioTypeToRankKey(ctx.scenarioObject.scenario) : null;
      const rankKeyForDrink =
        rankKeyFromObjEarly ??
        (intentionToScenarioKey(ctx.intent) !== "neutral"
          ? (intentionToScenarioKey(ctx.intent) as RecommendScenarioKey)
          : null);
      if (
        !relaxed &&
        rankKeyForDrink &&
        isDrinkOnlyCafeCard(card) &&
        shouldExcludeDrinkOnlyForScenarioRanking(rankKeyForDrink, strict, ctx.searchQuery ?? null)
      ) {
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

      const blobBase = normBlob(card);
      const blob = enrichBlobForScenarioScoring(blobBase);
      const km = distanceKmToCard(card, ctx);

      if (!relaxed && strict?.conversationExcludeMenuTerms?.length) {
        const blobC = normCompactBlobStr(blobBase);
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
    const forcedRaw = computeScenarioForcedRawDelta(ctx.scenarioObject?.scenario, blob);

    let activeScenario: RecommendScenarioKey;
    let scenarioS: number;
    let rawScenario: number;

    if (rankKeyFromObjEarly && scenarioCfg) {
      activeScenario = rankKeyFromObjEarly;
      const boost = configTagBoostRaw(blob, scenarioCfg);
      const typeFit = placeTypePreferenceRaw(card, scenarioCfg);
      rawScenario = scenarioRawForKey(blob, rankKeyFromObjEarly, card) + boost + typeFit + forcedRaw;
      const cap = (SCENARIO_RAW_CAP[rankKeyFromObjEarly] || 1) + 55;
      scenarioS = Math.min(100, (rawScenario / cap) * 100);
    } else {
      const picked = pickActiveScenario(card, ctx.intent, blob);
      activeScenario = picked.key;
      rawScenario = scenarioRawForKey(blob, activeScenario, card) + forcedRaw;
      scenarioS = scenarioNormFromRaw(
        Math.max(0, rawScenario),
        activeScenario
      );
    }

    const userScenarioKey = intentionToScenarioKey(ctx.intent);
    const voiceForContent = ctx.scenarioObject
      ? scenarioTypeToRankKey(ctx.scenarioObject.scenario)
      : userScenarioKey !== "neutral"
        ? userScenarioKey
        : activeScenario;

    const legacyIntent = ctx.scenarioObject ? scenarioObjectToIntention(ctx.scenarioObject) : ctx.intent;

    let bizS = businessScoreFromState(businessState);
    const cAny = card as any;
    if (businessState === "OPEN" && (cAny.open_now === true || cAny.is_open_now === true || cAny.open_now_status === true)) {
      bizS = Math.min(100, bizS + 5);
    }
    const qualS = ratingScoreFromCard(card);
    const kwS = keywordScoreFromQuery(ctx.searchQuery, card, blobBase);
    const bonS = bonusScoreFromCard(card, blobBase);

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

    let scenarioRich = scenarioS;
    if (useFoodRanking) {
      scenarioRich = Math.min(100, scenarioRich * 0.82 + foodS * 0.18);
    }
    if (useComposite) {
      scenarioRich = Math.min(100, scenarioRich * 0.88 + compS * 0.12);
    }
    const familyRank =
      rankKeyFromObjEarly === "family" ||
      (!ctx.scenarioObject && intentionToScenarioKey(ctx.intent) === "family");
    if (familyRank) {
      const cfp = childFriendlyScore(card) * 100;
      scenarioRich = Math.min(100, scenarioRich * 0.36 + cfp * 0.64);
    }

    distS *= distanceBlendForScenarioFit(scenarioRich);

    const convS = convenienceScoreFromParts(bizS, bonS, kwS);

    const globalImp = typeof window !== "undefined" ? getGlobalImpressionCount() : 0;
    const vis = behaviorBoostVisibilityFactor(globalImp);
    const rawBeh = typeof window !== "undefined" ? getPlaceBehaviorRaw(card.id) : 0;
    const behaviorPillar = normalizeBehaviorRawToScore(rawBeh);

    const hints =
      typeof window !== "undefined"
        ? getPersonalizationHints()
        : { preferredTags: [] as string[], avoidTags: [] as string[], preferredScenarios: [] as string[] };
    const personalizationS = personalizationFitScore(blobBase, ctx.scenarioObject ?? null, hints);

    const finalScore = computeHybridRecommendationFinal({
      distanceScore: distS,
      ratingScore: qualS,
      scenarioRichScore: scenarioRich,
      convenienceScore: convS,
      behaviorPillar,
      behaviorVisibility: vis,
      personalizationScore: personalizationS,
    });

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
      scenarioRichScore: scenarioRich,
      convenienceScore: convS,
      behaviorBoostPillar: behaviorPillar,
      behaviorVisibility: vis,
      personalizationScore: personalizationS,
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
      blockKidMessaging: voiceForContent === "family" ? shouldBlockKidFriendlyMessaging(card) : false,
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
            explicitScenario: rankKeyFromObjEarly!,
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
      recommendationVoice: voiceForContent,
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

  if (strictIntentCategorySearch) {
    return selectWithDiversity(scored, RECOMMEND_DECK_SIZE);
  }
  return pickDeckWithBackupRoles(
    scored,
    { scenarioObject: ctx.scenarioObject },
    rankKeyForCategory,
    RECOMMEND_DECK_SIZE
  ) as ScoredRecommendItem[];
}

/** strict 시나리오 랭킹 — 내부적으로 buildTopRecommendations와 동일 */
export function rankPlacesForScenario(
  candidates: HomeCard[],
  ctx: BuildRecommendationsContext
): ScoredRecommendItem[] {
  return buildTopRecommendations(candidates, ctx);
}

/** 홈 신뢰 픽 등 — 사용자 시나리오 없이 카드 텍스트만으로 대표 시나리오 축 추정 */
export function inferNeutralRecommendationVoice(card: HomeCard): RecommendScenarioKey {
  const blobBase = normBlob(card);
  const blob = enrichBlobForScenarioScoring(blobBase);
  return pickActiveScenario(card, "none", blob).key;
}
