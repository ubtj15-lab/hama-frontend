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
  isDrinkOnlyCafeForMealContext,
  shouldExcludeDrinkOnlyForScenarioRanking,
} from "./mealContextSignals";
import { isKidFocusedVenue, isKidVenueExcludedWhenNoYoungChild } from "./kidVenueSignals";
import { isBoardGameVenue, isCompanionSoloOnly } from "./boardVenueSignals";
import {
  isHardExcludedForFamilyKidsListRecommend,
  parentGatheringOrRestorativeQuery,
} from "./placeFamilyClassification";
import type { UserProfile } from "@/lib/onboardingProfile";

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
  userProfile?: UserProfile | null;
  relaxPersonalRules?: boolean;
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

function calcPersonalScore(card: HomeCard, profile: UserProfile | null | undefined, blobBase: string): number {
  if (!profile) return 50;
  const blob = blobBase.toLowerCase();
  let score = 50;
  const c = card as any;

  if (profile.companions.includes("가족") && (c.with_kids === true || /키즈|가족|체험|박물관/.test(blob))) score += 16;
  if (profile.companions.includes("둘이서") && /데이트|분위기|조용|와인|칵테일|전시/.test(blob)) score += 10;
  if (profile.companions.includes("친구") && /보드게임|단체|액티비티|홀덤|pc방|플스|노래방|회식/.test(blob)) score += 12;
  if (profile.companions.includes("혼자") && (c.for_work === true || /혼밥|1인|집중|조용/.test(blob))) score += 10;

  if (profile.interests.includes("전시/박물관") && (/museum|박물관|전시/.test(blob) || c.category === "museum")) score += 20;
  if (profile.interests.includes("산책/공원") && /산책|공원|야외|정원|한강|숲길/.test(blob)) score += 10;
  if (profile.interests.includes("액티비티") && /activity|액티비티|체험|클라이밍|방탈출|vr|보드게임/.test(blob)) score += 20;
  if (profile.interests.includes("만화카페/보드게임카페") && /만화|보드게임/.test(blob)) score += 30;
  if (profile.interests.includes("영화/공연") && /영화|공연|시네마|연극|뮤지컬|극장|cgv|롯데시네마|메가박스/.test(blob)) score += 10;

  if (profile.gender === "남성" && /홀덤|포커|pc방|플스방/.test(blob)) score += 25;
  if (profile.gender === "여성" && /여성전용|레이디|여성\s*전용/.test(blob)) score += 30;

  if (profile.dietary_restrictions.includes("알레르기") && /알레르기|allergen|원재료|성분표/.test(blob)) {
    score += 8;
  }

  if (profile.young_child === "있음") {
    if (c.with_kids === true) score += 12;
    if (isKidFocusedVenue(card)) score += 14;
    else if (/아이동반|유아|어린이\s*체험|키즈존|키즈룸/.test(blob)) score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

function violatesDietaryProfile(
  card: HomeCard,
  profile: UserProfile | null | undefined,
  relaxPersonalRules: boolean
): boolean {
  if (!profile || relaxPersonalRules) return false;
  const dietary = profile.dietary_restrictions;
  if (!dietary.length || dietary.includes("없음")) return false;
  const blob = normBlob(card);
  const c = card as any;
  if (dietary.includes("채식") && !(/비건|채식|vegan|vegetarian/.test(blob) || c.vegetarian_available === true)) {
    return true;
  }
  if (dietary.includes("할랄") && !(/할랄|halal/.test(blob) || c.halal_available === true)) {
    return true;
  }
  return false;
}

function beautySubcategoryMatches(card: HomeCard, beautySubCategory: string | null | undefined): boolean {
  if (!beautySubCategory) return true;
  const blob = normBlob(card);
  switch (beautySubCategory) {
    case "hair":
      return /hair|미용실|헤어|커트|컷|펌|염색/.test(blob);
    case "nail":
      return /nail|네일|네일아트/.test(blob);
    case "eyelash":
      return /eyelash|속눈썹|래쉬|lash/.test(blob);
    case "waxing":
      return /waxing|제모|왁싱|왁스/.test(blob);
    default:
      return true;
  }
}

function timeOfDayBonusForFoodCafe(card: HomeCard, strict: ScenarioObject | null | undefined, blob: string): number {
  if (!strict?.intentCategory) return 0;
  if (strict.intentCategory !== "FOOD" && strict.intentCategory !== "CAFE") return 0;
  const now = new Date();
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  const has = (re: RegExp) => re.test(blob);
  let bonus = 0;

  // 07:00~10:30
  if (minuteOfDay >= 420 && minuteOfDay < 630) {
    if (has(/브런치|브렉퍼스트|아침|베이커리|빵|카페|커피/)) bonus += 15;
  }
  // 10:30~14:00
  else if (minuteOfDay >= 630 && minuteOfDay < 840) {
    if (has(/브런치|점심|런치|식사|덮밥|국밥|샌드위치|베이커리/)) bonus += 20;
    if (strict.intentCategory === "CAFE" && has(/브런치|베이커리|디저트|샌드위치/)) bonus += 8;
  }
  // 14:00~17:00
  else if (minuteOfDay >= 840 && minuteOfDay < 1020) {
    if (has(/카페|디저트|케이크|빙수|베이커리|커피/)) bonus += 20;
  }
  // 17:00~21:00
  else if (minuteOfDay >= 1020 && minuteOfDay < 1260) {
    if (has(/저녁|디너|회식|가족\s*식사|식당|고기|한식|양식|중식|일식/)) bonus += 20;
  }
  // 21:00~
  else if (minuteOfDay >= 1260) {
    if (has(/늦게|야간|심야|카페|가벼운\s*식사|디저트|브런치/)) bonus += 15;
  }
  return bonus;
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
  if (c?.category === "museum") {
    if (key === "family") sum += /체험|키즈|어린이/.test(blob) ? 18 : 10;
    if (key === "date") sum += /분위기|야간|전시/.test(blob) ? 14 : 9;
    if (key === "solo") sum += 5;
  }
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

function preferredScenarioFromProfile(profile: UserProfile | null | undefined): RecommendScenarioKey | null {
  if (!profile) return null;
  const companions = profile.companions ?? [];
  if (companions.includes("가족")) return "family";
  if (companions.includes("둘이서")) return "date";
  if (companions.includes("친구")) return "group";
  if (companions.includes("혼자")) return "solo";
  return null;
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

function isChainCafe(card: HomeCard): boolean {
  const cat = String(card.category ?? "").toLowerCase();
  if (cat !== "cafe") return false;
  if (brandKey(card) != null) return true;
  const name = String(card.name ?? "").toLowerCase().replace(/\s+/g, "");
  return /스타벅스|메가(?:mgc)?커피|컴포즈|빽다방|이디야|투썸|할리스|탐앤탐스|폴바셋|엔제리너스|매머드/.test(
    name
  );
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
  const profileScenario = preferredScenarioFromProfile(ctx.userProfile);
  if (profileScenario) return profileScenario;
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
  const strictCafe =
    so?.intentType === "search_strict" &&
    so.intentCategory === "CAFE" &&
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
        const keepScenarioCategoryWhenRelaxed =
          so &&
          (so.scenario === "family_kids" ||
            so.scenario === "parent_child_outing" ||
            so.scenario === "family");
        if (keepScenarioCategoryWhenRelaxed) {
          if (!isCategoryAllowedForScenarioStrict(card, rankKeyForCategory)) continue;
        } else if (!isCategoryAllowedRelaxed(card, false)) {
          continue;
        }
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
      if (!relaxed && strictCafe && isChainCafe(card)) {
        continue;
      }
      if (violatesDietaryProfile(card, ctx.userProfile, Boolean(ctx.relaxPersonalRules))) {
        continue;
      }

      if (ctx.userProfile?.young_child === "없음" && isKidVenueExcludedWhenNoYoungChild(card)) {
        continue;
      }

      if (isCompanionSoloOnly(ctx.userProfile) && isBoardGameVenue(card)) {
        continue;
      }

      if (
        so &&
        (so.scenario === "family_kids" || so.scenario === "parent_child_outing") &&
        isHardExcludedForFamilyKidsListRecommend(card, so, ctx.searchQuery ?? null)
      ) {
        continue;
      }

      if (strict && !relaxed && strict.scenario === "family") {
        if (isHardExcludedForKidsScenario(card, { rawQuery: strict.rawQuery })) continue;
        const cat = normalizeCategory(card);
        if ((cat === "restaurant" || cat === "cafe") && childFriendlyScore(card) < 0.28) {
          continue;
        }
      }
      if (
        strict &&
        !relaxed &&
        (strict.scenario === "family_kids" || strict.scenario === "parent_child_outing")
      ) {
        const cat = normalizeCategory(card);
        const parentMealCtx = parentGatheringOrRestorativeQuery(
          `${strict.rawQuery ?? ""} ${ctx.searchQuery ?? ""}`.toLowerCase()
        );
        if (!parentMealCtx && (cat === "restaurant" || cat === "cafe") && childFriendlyScore(card) < 0.22) {
          continue;
        }
      }

      const rankKeyFromObjEarly = ctx.scenarioObject ? scenarioTypeToRankKey(ctx.scenarioObject.scenario) : null;
      const profileScenarioKey = preferredScenarioFromProfile(ctx.userProfile);
      const userScenarioKey = intentionToScenarioKey(ctx.intent);
      const explicitScenarioKey =
        rankKeyFromObjEarly ??
        (userScenarioKey !== "neutral" ? userScenarioKey : null) ??
        profileScenarioKey;
      const rankKeyForDrink =
        explicitScenarioKey;
      if (
        rankKeyForDrink &&
        isDrinkOnlyCafeForMealContext(card) &&
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

    if (explicitScenarioKey && scenarioCfg) {
      activeScenario = explicitScenarioKey;
      const boost = configTagBoostRaw(blob, scenarioCfg);
      const typeFit = placeTypePreferenceRaw(card, scenarioCfg);
      rawScenario = scenarioRawForKey(blob, explicitScenarioKey, card) + boost + typeFit + forcedRaw;
      const cap = (SCENARIO_RAW_CAP[explicitScenarioKey] || 1) + 55;
      scenarioS = Math.min(100, (rawScenario / cap) * 100);
    } else if (explicitScenarioKey) {
      activeScenario = explicitScenarioKey;
      rawScenario = scenarioRawForKey(blob, explicitScenarioKey, card) + forcedRaw;
      scenarioS = scenarioNormFromRaw(Math.max(0, rawScenario), explicitScenarioKey);
    } else {
      const picked = pickActiveScenario(card, ctx.intent, blob);
      activeScenario = picked.key;
      rawScenario = scenarioRawForKey(blob, activeScenario, card) + forcedRaw;
      scenarioS = scenarioNormFromRaw(
        Math.max(0, rawScenario),
        activeScenario
      );
    }

    const voiceForContent = explicitScenarioKey ?? activeScenario;

    const legacyIntent = ctx.scenarioObject ? scenarioObjectToIntention(ctx.scenarioObject) : ctx.intent;

    let bizS = businessScoreFromState(businessState);
    const cAny = card as any;
    if (businessState === "OPEN" && (cAny.open_now === true || cAny.is_open_now === true || cAny.open_now_status === true)) {
      bizS = Math.min(100, bizS + 5);
    }
    const qualS = ratingScoreFromCard(card);
    const kwS = keywordScoreFromQuery(ctx.searchQuery, card, blobBase);
    let bonS = bonusScoreFromCard(card, blobBase);
    if (isChainCafe(card)) {
      bonS = Math.max(0, bonS - 12);
    }

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
      explicitScenarioKey === "family";
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
    const signalPersonalization = personalizationFitScore(blobBase, ctx.scenarioObject ?? null, hints);
    const profilePersonal = calcPersonalScore(card, ctx.userProfile, blobBase);
    const personalizationS = Math.round(signalPersonalization * 0.4 + profilePersonal * 0.6);

    let finalScore = computeHybridRecommendationFinal({
      distanceScore: distS,
      ratingScore: qualS,
      scenarioRichScore: scenarioRich,
      convenienceScore: convS,
      behaviorPillar,
      behaviorVisibility: vis,
      personalizationScore: personalizationS,
    });
    if (isChainCafe(card)) {
      finalScore = Math.max(0, finalScore - 22);
    }

    if (
      strict?.intentCategory === "BEAUTY" &&
      strict.beautySubCategory &&
      strict.intentType !== "course_generation" &&
      !beautySubcategoryMatches(card, strict.beautySubCategory)
    ) {
      finalScore = Math.max(0, finalScore - 50);
    }

    finalScore = Math.max(0, Math.min(100, finalScore + timeOfDayBonusForFoodCafe(card, strict, blob)));

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
