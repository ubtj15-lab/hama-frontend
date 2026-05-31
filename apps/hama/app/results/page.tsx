"use client";

import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useHomeCards } from "@/_hooks/useHomeCards";
import { useHomeMode } from "@/_hooks/useHomeMode";
import { useRecent } from "@/_hooks/useRecent";
import { usePlaceNameSearchResults } from "@/_hooks/usePlaceNameSearchResults";
import { explainPlaceNameSearchGate, normalizeBrandQuery } from "@/lib/results/placeNameSearchIntent";
import {
  parseScenarioIntent,
  explainCourseGenerationMatch,
} from "@/lib/scenarioEngine/parseScenarioIntent";
import {
  loadConversationContext,
  processConversationTurn,
  summarizeActiveConstraints,
  patchLastRecommendations,
  type ConversationContext,
} from "@/lib/conversation";
import { scenarioObjectToIntention } from "@/lib/scenarioEngine/scenarioRankBridge";
import { resolveScenarioConfig } from "@/lib/scenarioEngine/resolveScenarioConfig";
import { generateCourses } from "@/lib/scenarioEngine/courseEngine";
import { fetchRecommendationPatternBoostMap } from "@/lib/recommend/getPatternBoost";
import { applyRecommendationModeToScenario } from "@/lib/scenarioEngine/effectiveScenario";
import type { RecommendationMode, ScenarioObject } from "@/lib/scenarioEngine/types";
import type { IntentionType } from "@/lib/intention";
import type { NamedFoodPreset } from "@/lib/recommend/namedFoodPresets";
import type { HomeCard } from "@/lib/storeTypes";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import {
  HYBRID_WEIGHT_BEHAVIOR,
  HYBRID_WEIGHT_CONVENIENCE,
  HYBRID_WEIGHT_DISTANCE,
  HYBRID_WEIGHT_PERSONAL,
  HYBRID_WEIGHT_RATING,
  HYBRID_WEIGHT_SCENARIO,
  RECOMMEND_DECK_SIZE,
  RECENT_EXCLUDE_LIMIT,
} from "@/lib/recommend/recommendConstants";
import {
  isSoloSituationIntentQuery,
  matchNamedFoodPreset,
  matchesTonkatsuBetaDisabledQuery,
} from "@/lib/recommend/namedFoodPresets";
import { ResultsHeader } from "@/_components/results/ResultsHeader";
import { ActiveConstraintChips } from "@/_components/results/ActiveConstraintChips";
import { RecommendationList } from "@/_components/results/RecommendationList";
import { SearchResultSection } from "@/_components/results/SearchResultSection";
import { CourseDeckCard } from "@/_components/results/CourseDeckCard";
import { NextSuggestions } from "@/_components/results/NextSuggestions";
import { colors, radius, space } from "@/lib/designTokens";
import { logEvent } from "@/lib/logEvent";
import { HamaEvents } from "@/lib/analytics/events";
import { analyticsFromScenario, mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import { openDirections } from "@/lib/openDirections";
import { stashPlaceForSession } from "@/lib/session/placeSession";
import { readCoursePlanWithFallback, stashCoursePlan, encodeCoursePlanSnapshot } from "@/lib/session/courseSession";
import { homeCardsFromCourseStops } from "@/lib/course/courseCardSnapshot";
import { logCourseDebug } from "@/lib/course/courseDebugLog";
import {
  logCourseRandomFallbackBlocked,
  logCourseRestoreFail,
  logCourseRestoreSuccess,
  logCourseRouteEnter,
} from "@/lib/analytics/courseEvents";
import { recordRecentIntent } from "@/lib/recentIntents";
import { recordPwaEngagement } from "@/lib/pwa/pwaEngagement";
import FeedbackFab from "@/components/FeedbackFab";
import { logRecommendationEvent } from "@/lib/analytics/logRecommendationEvent";
import { parseUserProfile, type UserProfile } from "@/lib/onboardingProfile";
import { hamaDevLog } from "@/lib/hamaDevLog";
import { mergeResultsScenarioWithExplicitNav, normalizeResultsExplicitCategory, passesBeautyIndustryWhitelist, passesCultureIndustryWhitelist, strictExplicitGateCategoryFromUrl } from "@/lib/hamaResultCategoryCanonical";
import { USE_RECOMMEND_V2 } from "@/lib/recommend-v2/recommendV2Flags";
import { isBeautyUrlFromExplicitNav, isBeautyV2HardMode } from "@/lib/recommend-v2/beautyV2HardMode";
import { shouldApplyCultureStrictWhitelist } from "@/lib/recommend-v2/normalizeRequest";
import { useHamaMe } from "@/lib/auth/useHamaMe";
import { kakaoLoginUrl } from "@/lib/auth/kakaoLogin";

/** 결과 페이지만: 고정 더미로 SearchResultSection/분기 검증 — `.env.local` 에 `NEXT_PUBLIC_DEBUG_FORCE_SEARCH_SECTION=1` */
const DEBUG_FORCE_SEARCH_SECTION = process.env.NEXT_PUBLIC_DEBUG_FORCE_SEARCH_SECTION === "1";
const FAMILY_DINING_ALIAS_QUERIES = new Set([
  "가족 외식",
  "가족외식",
  "가족 식사",
  "가족이랑 외식",
  "가족이랑 밥",
  "가족이랑 식사",
]);

const QUERY_ALIAS_EXPANSION: Record<string, string> = {
  문화생활: "박물관 전시 미술관 도서관 체험 문화",
  데이트: "카페 분위기 좋은 레스토랑 산책 디저트",
  "아이랑 갈만한 곳": "키즈카페 공원 도서관 체험 가족",
  "아이랑 밥": "가족 아이랑 식당 한식 분식",
  "비오는날 실내": "카페 도서관 박물관 실내 키즈카페",
  "조용한 카페": "카페 조용한 감성",
};
const RESULTS_SITUATION_PRESET_QUERIES = new Set([
  "문화생활",
  "데이트",
  "아이랑 갈만한 곳",
  "비오는날 실내",
]);

function intentCategoryToCategoryClicked(intentCategory: string | null | undefined): string | null {
  if (!intentCategory) return null;
  if (intentCategory === "FOOD") return "푸드";
  if (intentCategory === "CAFE") return "카페";
  if (intentCategory === "BEAUTY") return "미용실";
  if (intentCategory === "FITNESS") return "운동";
  if (intentCategory === "LIFE") return "생활";
  if (intentCategory === "ACTIVITY") return "액티비티";
  return intentCategory;
}

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseIdFromSearch = searchParams.get("courseId")?.trim() ?? "";
  const courseSnapFromSearch = searchParams.get("courseSnap")?.trim() ?? "";
  const qRaw = searchParams.get("q")?.trim() ?? "";
  const explicitIntent = searchParams.get("intent")?.trim() || null;
  const explicitCategory = searchParams.get("category")?.trim() || null;
  const explicitMode = searchParams.get("mode")?.trim() || null;
  const resultsUrlPrimitiveKey = useMemo(
    () =>
      [qRaw, explicitIntent ?? "", explicitCategory ?? "", explicitMode ?? "", courseIdFromSearch, courseSnapFromSearch].join(
        "\u001f"
      ),
    [qRaw, explicitIntent, explicitCategory, explicitMode, courseIdFromSearch, courseSnapFromSearch]
  );
  /** Chrome 등 첫 프레임에서 searchParams와 window.location 불일치 방지 */
  const [courseIdSynced, setCourseIdSynced] = useState(courseIdFromSearch);
  const [hashCourseSnap, setHashCourseSnap] = useState<string | null>(null);
  const [fixedPlan, setFixedPlan] = useState<CoursePlan | null>(null);
  const [restoreSource, setRestoreSource] = useState<import("@/lib/session/courseSession").CourseRestoreSource | null>(null);
  const [restoreDone, setRestoreDone] = useState(false);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const p = new URLSearchParams(window.location.search);
      const cid = p.get("courseId")?.trim() ?? "";
      if (cid) setCourseIdSynced(cid);
      const h = window.location.hash;
      if (h.startsWith("#hamaCourseSnap=")) {
        setHashCourseSnap(decodeURIComponent(h.slice("#hamaCourseSnap=".length)));
      }
    } catch {}
  }, []);

  useEffect(() => {
    recordPwaEngagement();
  }, []);

  useEffect(() => {
    if (!qRaw && !courseIdFromSearch) return;
    console.log("[results explicit params]", {
      q: qRaw,
      explicitIntent,
      explicitCategory,
      mode: explicitMode,
    });
  }, [qRaw, courseIdFromSearch, explicitIntent, explicitCategory, explicitMode]);

  const courseIdParam = courseIdSynced || courseIdFromSearch;

  const queryForScenario = useMemo(
    () => qRaw || fixedPlan?.sourceQuery?.trim() || fixedPlan?.situationTitle?.trim() || "",
    [qRaw, fixedPlan?.sourceQuery, fixedPlan?.situationTitle]
  );

  const [shuffleKey, setShuffleKey] = useState(0);
  const [rejectedMainPickIds, setRejectedMainPickIds] = useState<string[]>([]);
  const [courseFilter, setCourseFilter] = useState<"all" | "food" | "indoor" | "under3h">("all");
  const [retryInput, setRetryInput] = useState("");
  const started = useRef<number>(0);
  const [modeOverride, setModeOverride] = useState<RecommendationMode | null>(null);

  const [convCtx, setConvCtx] = useState<ConversationContext | null>(null);

  const [serverProfile, setServerProfile] = useState<UserProfile | null>(null);
  const [profileOverride, setProfileOverride] = useState<Partial<UserProfile> | null>(null);
  const [scenarioPatch, setScenarioPatch] = useState<Partial<ScenarioObject> | null>(null);
  const [relaxPersonalRules, setRelaxPersonalRules] = useState(false);
  const recommendSessionIdRef = useRef<string | null>(null);
  const [recommendSessionId, setRecommendSessionId] = useState<string | null>(null);
  const { isLoggedIn } = useHamaMe();

  const requireKakaoLogin = React.useCallback(() => {
    const message = "추천 결과는 볼 수 있어요. 이 기능은 카카오 로그인 후 사용할 수 있어요.";
    const proceed = window.confirm(`${message}\n\n카카오 로그인 하시겠어요?`);
    if (!proceed) return;
    window.location.href = kakaoLoginUrl(`${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/users/me/profile", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setServerProfile(parseUserProfile(json?.user_profile));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setModeOverride(null);
  }, [qRaw]);

  useEffect(() => {
    setRejectedMainPickIds([]);
  }, [qRaw]);

  useEffect(() => {
    const q = queryForScenario;
    if (!q && !courseIdParam) {
      setConvCtx(null);
      return;
    }
    if (!q) return;
    const prev = loadConversationContext();
    setConvCtx(processConversationTurn(q, prev));
  }, [queryForScenario, courseIdParam]);

  useEffect(() => {
    started.current = performance.now();
    setShuffleKey((k) => k + 1);
  }, [qRaw]);

  useEffect(() => {
    // 새 추천 세션마다 ID를 갱신 (보정/거절/클릭을 같은 세션에 묶기)
    try {
      recommendSessionIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    } catch {
      recommendSessionIdRef.current = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    setRecommendSessionId(recommendSessionIdRef.current);
  }, [qRaw, shuffleKey]);

  useEffect(() => {
    if (!courseIdParam && !qRaw) router.replace("/");
  }, [qRaw, courseIdParam, router]);

  /** courseId만 있고 q 없으면 복원된 코스의 sourceQuery로 URL 보강(선택) */
  useEffect(() => {
    if (!courseIdParam || qRaw) return;
    const sq = fixedPlan?.sourceQuery?.trim();
    if (sq) {
      router.replace(`/results?q=${encodeURIComponent(sq)}&courseId=${encodeURIComponent(courseIdParam)}`);
    }
  }, [courseIdParam, qRaw, router, fixedPlan?.sourceQuery]);

  useEffect(() => {
    if (!courseIdParam) {
      setFixedPlan(null);
      setRestoreSource(null);
      setRestoreDone(true);
      return;
    }
    setRestoreDone(false);
    const snap = courseSnapFromSearch || undefined;
    const hs = hashCourseSnap || undefined;
    logCourseDebug({
      event: "course_route_enter",
      courseId: courseIdParam,
      extra: { has_query_snap: Boolean(snap), has_hash_snap: Boolean(hs), ua: typeof navigator !== "undefined" ? navigator.userAgent : "" },
    });
    logCourseRouteEnter({
      courseId: courseIdParam,
      hasQuerySnap: Boolean(snap),
      hasHashSnap: Boolean(hs),
    });
    const { plan, source } = readCoursePlanWithFallback(courseIdParam, {
      courseSnapB64: snap,
      hashSnapB64: hs,
    });
    setFixedPlan(plan);
    setRestoreSource(source);
    setRestoreDone(true);
    if (plan) {
      const pseudoForLog: ScenarioObject = {
        intentType: "course_generation",
        scenario: plan.scenario,
        rawQuery: plan.situationTitle ?? plan.functionalTitle ?? "",
        confidence: 0.8,
      };
      logCourseDebug({
        event: "course_restore_success",
        courseId: courseIdParam,
        stepIds: plan.stops.map((s) => s.placeId),
        source: source ?? "restored",
      });
      logCourseRestoreSuccess({
        courseId: courseIdParam,
        placeIds: plan.stops.map((s) => s.placeId),
        restoreSource: source,
        scenarioObject: pseudoForLog,
      });
    } else {
      logCourseDebug({
        event: "course_restore_fail",
        courseId: courseIdParam,
        source: null,
      });
      logCourseRestoreFail({ courseId: courseIdParam });
    }
  }, [courseIdParam, courseSnapFromSearch, hashCourseSnap]);

  const fixedCourseFromSession = fixedPlan;

  const scenarioObject = useMemo(() => {
    const base = mergeResultsScenarioWithExplicitNav(
      queryForScenario,
      convCtx,
      explicitCategory,
      explicitIntent
    );
    if (!base) return null;
    let out: ScenarioObject = scenarioPatch ? { ...base, ...scenarioPatch } : base;
    if (explicitMode === "course") {
      out = {
        ...out,
        recommendationMode: "course",
        intentType: "course_generation",
      };
    }
    return out;
  }, [queryForScenario, convCtx, scenarioPatch, explicitMode, explicitCategory, explicitIntent]);

  const effectiveMode: RecommendationMode = useMemo(() => {
    const inferred = scenarioObject?.recommendationMode ?? "single";
    return modeOverride ?? inferred;
  }, [scenarioObject?.recommendationMode, modeOverride]);

  const effectiveScenario = useMemo(() => {
    if (!scenarioObject) return null;
    return applyRecommendationModeToScenario(scenarioObject, effectiveMode);
  }, [scenarioObject, effectiveMode]);

  const mergedProfileForRanking = useMemo(() => {
    if (!serverProfile) return profileOverride ?? null;
    if (!profileOverride) return serverProfile;
    return {
      ...serverProfile,
      ...profileOverride,
      companions:
        profileOverride.companions != null && profileOverride.companions.length > 0
          ? profileOverride.companions
          : serverProfile.companions,
      dietary_restrictions:
        profileOverride.dietary_restrictions != null && profileOverride.dietary_restrictions.length > 0
          ? profileOverride.dietary_restrictions
          : serverProfile.dietary_restrictions,
      interests:
        profileOverride.interests != null && profileOverride.interests.length > 0
          ? profileOverride.interests
          : serverProfile.interests,
      gender: profileOverride.gender ?? serverProfile.gender,
      young_child: profileOverride.young_child ?? serverProfile.young_child,
      onboarding_completed_at: serverProfile.onboarding_completed_at,
    };
  }, [serverProfile, profileOverride]);

  const hybridWeightsForLog = useMemo(
    () => ({
      distance: HYBRID_WEIGHT_DISTANCE,
      rating: HYBRID_WEIGHT_RATING,
      scenario: HYBRID_WEIGHT_SCENARIO,
      convenience: HYBRID_WEIGHT_CONVENIENCE,
      behavior: HYBRID_WEIGHT_BEHAVIOR,
      personal: HYBRID_WEIGHT_PERSONAL,
    }),
    []
  );

  const analyticsV2Base = useMemo(() => {
    if (!recommendSessionId || !effectiveScenario) return null;
    return {
      recommendation_id: recommendSessionId,
      category_clicked: intentCategoryToCategoryClicked(effectiveScenario.intentCategory),
      user_profile: (mergedProfileForRanking ?? {}) as unknown as Record<string, unknown>,
      scenario: effectiveScenario.scenario,
      weights: hybridWeightsForLog,
    };
  }, [recommendSessionId, effectiveScenario, mergedProfileForRanking, hybridWeightsForLog]);

  const constraintChips = useMemo(
    () => (effectiveScenario ? summarizeActiveConstraints(effectiveScenario) : []),
    [effectiveScenario]
  );

  const intent: IntentionType = useMemo(() => {
    if (!effectiveScenario) return "none";
    return scenarioObjectToIntention(effectiveScenario);
  }, [effectiveScenario]);

  const { loc: userLoc, isLocLoading } = useHomeMode();
  const { recentCards, recordView, loading: recentLoading } = useRecent();
  const recentExcludeIds = useMemo(
    () => recentCards.slice(0, RECENT_EXCLUDE_LIMIT).map((c) => c.id),
    [recentCards]
  );

  const rankingBootstrapReady = !isLocLoading && !recentLoading;

  const qNormalizedForIntent = useMemo(() => normalizeBrandQuery(qRaw).trim(), [qRaw]);
  const isSoloSituationQuery = useMemo(() => isSoloSituationIntentQuery(qRaw), [qRaw]);
  /** URL q 직후 — 음식 세부 프리셋(파스타 등)은 시나리오보다 우선. 단, 혼밥/혼자/1인은 상황 intent 우선 */
  const matchedNamedFoodPreset = useMemo(
    () => (isSoloSituationQuery ? null : matchNamedFoodPreset(qRaw)),
    [isSoloSituationQuery, qRaw]
  );
  const tonkatsuRecommendDisabled = matchesTonkatsuBetaDisabledQuery(qRaw);

  /** URL q가 단독 "박물관"일 때는 누적 대화(convCtx)가 searchQuery를 덮어쓰지 않음 — 홈 문화 타일과 히어로 직접 입력 경로 일치 */
  const searchQueryForHomeCards = useMemo(() => {
    const qTrim = qRaw.trim();
    /** 혼밥/혼자/1인 — 누적 대화 텍스트가 `searchQuery`를 덮으면 useHomeCards solo guard가 전부 스킵됨 */
    if (isSoloSituationQuery) return qTrim || null;
    if (matchedNamedFoodPreset) return qTrim || null;
    if (qTrim === "박물관") return qTrim;
    if (qTrim === "도서관") return qTrim;
    // /results 경로에서는 상황어 원문을 그대로 넘겨야 useHomeCards preset이 정확히 동작한다.
    if (RESULTS_SITUATION_PRESET_QUERIES.has(qTrim)) return qTrim;
    if (QUERY_ALIAS_EXPANSION[qTrim]) return QUERY_ALIAS_EXPANSION[qTrim];
    if ((explicitCategory ?? "").trim().toLowerCase() === "culture") return qRaw || null;
    const qNorm = normalizeBrandQuery(qRaw).trim();
    if (FAMILY_DINING_ALIAS_QUERIES.has(qTrim) || FAMILY_DINING_ALIAS_QUERIES.has(qNorm)) return "식당";
    /** 푸드는 곧 URL이 식당으로 치환되며, 그 전 한 프레임용으로도 식당 토큰과 동일 랭킹 입력을 씀 */
    if (qNorm === "푸드") return "식당";
    if (qNorm === "식당" || qNorm === "맛집") return qNorm;
    return (convCtx?.cumulativeText ?? qRaw) || null;
  }, [qRaw, explicitCategory, convCtx?.cumulativeText, matchedNamedFoodPreset, isSoloSituationQuery]);

  /** 프리셋일 때 코스·데이트 시나리오가 랭킹/페치를 가로채지 않도록 단일 식당 맥락으로 고정 */
  const scenarioObjectForHomeCards = useMemo((): ScenarioObject | undefined => {
    if (!matchedNamedFoodPreset) return effectiveScenario ?? undefined;
    const trimmed = qRaw.trim();
    const base = effectiveScenario;
    return {
      scenario: "generic",
      intentType: "scenario_recommendation",
      recommendationMode: "single",
      intentCategory: "FOOD",
      rawQuery: trimmed || base?.rawQuery || "",
      confidence: 0.86,
      conversationExcludePlaceIds: base?.conversationExcludePlaceIds,
    };
  }, [matchedNamedFoodPreset, effectiveScenario, qRaw]);

  const intentForHomeCards: IntentionType = matchedNamedFoodPreset ? "none" : intent;
  /** TS가 showNameSearch 분기 안에서 매장명 전용이라 food preset을 never로 줄이므로 카드 렌더는 이 ref 사용 */
  const namedFoodPresetIdForListRef: NamedFoodPreset | null = matchedNamedFoodPreset;

  useEffect(() => {
    const payload = {
      qRaw,
      matchedNamedFoodPreset,
      presetId: matchedNamedFoodPreset?.id,
      subIntent: matchedNamedFoodPreset?.subIntent,
    };
    hamaDevLog("[HAMA_FOOD_PRESET_ROUTE_CHECK]", payload);
  }, [qRaw, matchedNamedFoodPreset]);

  const isFamilyDiningAliasQuery = useMemo(
    () => FAMILY_DINING_ALIAS_QUERIES.has(qRaw.trim()) || FAMILY_DINING_ALIAS_QUERIES.has(qNormalizedForIntent),
    [qRaw, qNormalizedForIntent]
  );
  const isGenericFoodResultsQuery = useMemo(
    () => qNormalizedForIntent === "푸드" || qNormalizedForIntent === "식당" || qNormalizedForIntent === "맛집",
    [qNormalizedForIntent]
  );
  const resolvedExplicitIntentForHome =
    isFamilyDiningAliasQuery || isGenericFoodResultsQuery || Boolean(matchedNamedFoodPreset)
      ? "food_general"
      : explicitIntent;
  const resolvedExplicitCategoryForHome =
    isFamilyDiningAliasQuery || isGenericFoodResultsQuery || Boolean(matchedNamedFoodPreset)
      ? "restaurant"
      : explicitCategory;
  const resolvedModeForHome =
    isFamilyDiningAliasQuery || Boolean(matchedNamedFoodPreset) ? "single" : explicitMode;

  const beautyUrlFinalGuard = useMemo(
    () => isBeautyUrlFromExplicitNav(resolvedExplicitCategoryForHome, resolvedExplicitIntentForHome),
    [resolvedExplicitCategoryForHome, resolvedExplicitIntentForHome]
  );

  const cultureUrlFinalGuard = useMemo(
    () =>
      shouldApplyCultureStrictWhitelist(
        resolvedExplicitCategoryForHome,
        resolvedExplicitIntentForHome,
        qRaw
      ),
    [resolvedExplicitCategoryForHome, resolvedExplicitIntentForHome, qRaw]
  );

  useEffect(() => {
    if (!isFamilyDiningAliasQuery) return;
    console.log("[family dining alias route]", {
      qRaw,
      normalizedQuery: qNormalizedForIntent,
      aliasedSearchQuery: "식당",
      explicitIntent: resolvedExplicitIntentForHome,
      explicitCategory: resolvedExplicitCategoryForHome,
      modeOverride: resolvedModeForHome,
    });
  }, [
    isFamilyDiningAliasQuery,
    qRaw,
    qNormalizedForIntent,
    resolvedExplicitIntentForHome,
    resolvedExplicitCategoryForHome,
    resolvedModeForHome,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    console.log("[HAMA_TAB_ROUTE_DEBUG]", {
      qRaw,
      explicitCategory,
      explicitIntent,
      canonicalExplicitCategory: normalizeResultsExplicitCategory(explicitCategory),
      strictGateCategory: strictExplicitGateCategoryFromUrl(explicitCategory, explicitIntent),
      contextTab: scenarioObjectForHomeCards?.intentCategory ?? effectiveScenario?.intentCategory ?? null,
      tab: "all",
      fab: true,
      routePrimitiveKey: resultsUrlPrimitiveKey,
    });
  }, [
    resultsUrlPrimitiveKey,
    qRaw,
    explicitCategory,
    explicitIntent,
    explicitMode,
    scenarioObjectForHomeCards?.intentCategory,
    effectiveScenario?.intentCategory,
  ]);

  /** q=푸드 → q=식당 으로 완전 동일 경로(시나리오·렌더·추천). intent/category 없으면 식당 직접 진입과 맞춤 */
  useEffect(() => {
    if (qNormalizedForIntent !== "푸드") return;
    const usp = new URLSearchParams(searchParams.toString());
    usp.set("q", "식당");
    const nextQs = usp.toString();
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const path = `/results?${nextQs}${hash}`;
    console.log("[food alias query]", {
      qRaw,
      normalizedQuery: qNormalizedForIntent,
      aliasedSearchQuery: "식당",
      explicitIntent: searchParams.get("intent")?.trim() || "food_general",
      explicitCategory: searchParams.get("category")?.trim() || "restaurant",
      replaceTo: path,
    });
    router.replace(path);
  }, [qRaw, qNormalizedForIntent, router, searchParams]);

  /** 푸드/식당/맛집: 시나리오가 코스로 잡히면 showRecommendationList가 false가 되어 카드가 숨겨짐 → 단일 모드 고정 */
  useEffect(() => {
    if (courseIdParam) return;
    if (!isGenericFoodResultsQuery && !isFamilyDiningAliasQuery && !matchedNamedFoodPreset && !isSoloSituationQuery) return;
    setModeOverride("single");
  }, [courseIdParam, isGenericFoodResultsQuery, isFamilyDiningAliasQuery, matchedNamedFoodPreset, isSoloSituationQuery, qRaw]);

  const placeNameGate = useMemo(() => explainPlaceNameSearchGate(qRaw), [qRaw]);
  /** 음식 세부 프리셋 쿼리는 "매장명 검색"으로 오인하지 않음 — deferRanking으로 페치가 막히는 것 방지 */
  const placeSearchEnabled = !matchedNamedFoodPreset && !isSoloSituationQuery && placeNameGate.enabled;
  const { items: placeHits, loading: placeSearchLoading, meta: placeSearchMeta } = usePlaceNameSearchResults(
    qRaw,
    placeSearchEnabled,
    userLoc?.lat,
    userLoc?.lng
  );

  const deferRecForPlaceLookup = matchedNamedFoodPreset ? false : placeSearchEnabled && placeSearchLoading;
  const placeLookupDoneEarly = !placeSearchEnabled || !placeSearchLoading;
  /** 매장명 API 성공(1건 이상)이면 추천/코스 후보 페치를 하지 않음 → 리스트가 뒤에서 덮어쓰이지 않음 */
  const placeSearchDominant = placeSearchEnabled && placeLookupDoneEarly && placeHits.length > 0;
  const resultsFlowMode = placeSearchDominant ? "place_search" : "recommendation";

  useEffect(() => {
    if (typeof window === "undefined") return;
    console.log("[results entry compare]", {
      href: window.location.href,
      qRaw,
      explicitIntent,
      explicitCategory,
      explicitMode,
      searchQueryPassedToUseHomeCards: searchQueryForHomeCards,
    });
  }, [qRaw, explicitIntent, explicitCategory, explicitMode, searchQueryForHomeCards]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    console.log("[generic food results route]", {
      qRaw,
      normalizedQuery: qNormalizedForIntent,
      placeSearchEnabled: placeNameGate.enabled,
      explicitIntentFromUrl: explicitIntent,
      explicitCategoryFromUrl: explicitCategory,
      forcedIntent: isGenericFoodResultsQuery ? "food_general" : null,
      forcedCategory: isGenericFoodResultsQuery ? "restaurant" : null,
      intentPassedToUseHomeCards: resolvedExplicitIntentForHome,
      categoryPassedToUseHomeCards: resolvedExplicitCategoryForHome,
    });
  }, [
    qRaw,
    qNormalizedForIntent,
    placeNameGate.enabled,
    explicitIntent,
    explicitCategory,
    isGenericFoodResultsQuery,
    resolvedExplicitIntentForHome,
    resolvedExplicitCategoryForHome,
  ]);

  const { cards, deckRotationKey, recommendEngine, candidatePool, courseCandidatePool, isLoading, deckIncomplete } =
    useHomeCards(
    "all",
    shuffleKey,
    intentForHomeCards,
    {
      userLat: userLoc?.lat ?? null,
      userLng: userLoc?.lng ?? null,
      excludeStoreIds: recentExcludeIds,
      rejectedMainPickIds,
      profileOverride,
      relaxPersonalRules,
      searchQuery: searchQueryForHomeCards,
      scenarioObject: scenarioObjectForHomeCards,
      /** 매장명 검색이 끝날 때까지 추천 페치·랭킹 지연 — 첫 프레임 레이스 방지 */
      deferRanking: !rankingBootstrapReady || deferRecForPlaceLookup,
      /** 세션에 고정된 코스로 돌아온 경우 재랭킹·재페치 없음 · 돈까스 프리셋 오베 전 비활성화 시 추천 페치 생략 */
      skipFetch: Boolean(courseIdParam) || tonkatsuRecommendDisabled,
      /**
       * 매장명 매칭 후에도 추천 풀은 가져온다. 메인 리스트는 `!showNameSearch`일 때만 그려서
       * 검색 카드가 덮어쓰이지 않고, `secondaryRecommendCards`로 "이런 곳도 있어"만 채운다.
       */
      explicitIntent: resolvedExplicitIntentForHome,
      explicitCategory: resolvedExplicitCategoryForHome,
      explicitMode: resolvedModeForHome,
      namedFoodPreset: matchedNamedFoodPreset ?? undefined,
      recommendedDeckCap: matchedNamedFoodPreset ? 5 : undefined,
    }
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isGenericFoodResultsQuery) return;
    console.log("[generic food useHomeCards result]", {
      qRaw,
      searchQuery: searchQueryForHomeCards,
      explicitIntent: resolvedExplicitIntentForHome,
      explicitCategory: resolvedExplicitCategoryForHome,
      loading: isLoading,
      cardsCount: cards?.length ?? 0,
      topNames: cards?.slice(0, 5).map((c) => c.name) ?? [],
    });
  }, [
    isGenericFoodResultsQuery,
    qRaw,
    searchQueryForHomeCards,
    resolvedExplicitIntentForHome,
    resolvedExplicitCategoryForHome,
    isLoading,
    cards,
  ]);

  const bootstrapBusy = !rankingBootstrapReady;
  const pageBusy = !rankingBootstrapReady || isLoading;
  const placeLookupBusy = placeSearchEnabled && placeSearchLoading;
  const placeLookupDone = !placeSearchEnabled || !placeSearchLoading;
  const showNameSearch = placeSearchEnabled && placeLookupDone && placeHits.length > 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (qRaw.trim() !== "박물관") return;
    console.log("[results museum compare]", {
      href: window.location.href,
      qRaw,
      explicitIntent,
      explicitCategory,
      explicitMode,
      searchQueryPassedToUseHomeCards: searchQueryForHomeCards,
      placeSearchEnabled,
      placeSearchQuery: qRaw,
      placeSearchResultsCount: placeHits.length,
    });
  }, [
    qRaw,
    explicitIntent,
    explicitCategory,
    explicitMode,
    searchQueryForHomeCards,
    placeSearchEnabled,
    placeHits.length,
  ]);

  const placeHitIds = useMemo(() => new Set(placeHits.map((c) => c.id)), [placeHits]);
  /** 뷰티 URL: 매장명 검색 히트 제외·primary/secondary 분리 없이 홈 카드 전체를 후보로 쓴다 */
  const secondaryRecommendCards = useMemo(
    () => (beautyUrlFinalGuard ? cards : cards.filter((c) => !placeHitIds.has(c.id))),
    [beautyUrlFinalGuard, cards, placeHitIds]
  );

  const [recommendationPatternBoostMap, setRecommendationPatternBoostMap] = useState(
    () => new Map<string, number>()
  );

  useEffect(() => {
    if (!effectiveScenario || effectiveScenario.recommendationMode !== "course") {
      setRecommendationPatternBoostMap(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      const m = await fetchRecommendationPatternBoostMap(effectiveScenario.scenario);
      if (!cancelled) setRecommendationPatternBoostMap(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveScenario?.scenario, effectiveScenario?.recommendationMode]);

  const coursePlans = useMemo(() => {
    if (courseIdParam) return [];
    if (!effectiveScenario || effectiveScenario.recommendationMode !== "course") return [];
    const pool = courseCandidatePool.length ? courseCandidatePool : candidatePool;
    if (!pool.length) return [];
    const cfg = resolveScenarioConfig(effectiveScenario);
    return generateCourses(pool, effectiveScenario, cfg, 3, {
      homeTab: "all",
      recommendationPatternBoostMap,
    });
  }, [courseIdParam, effectiveScenario, candidatePool, courseCandidatePool, recommendationPatternBoostMap]);

  useEffect(() => {
    if (courseIdParam || coursePlans.length === 0) return;
    const p = coursePlans[0];
    if (!p) return;
    logCourseDebug({
      event: "course_generate",
      courseId: p.id,
      stepIds: p.stops.map((s) => s.placeId),
      extra: { ua: typeof navigator !== "undefined" ? navigator.userAgent : "" },
    });
  }, [coursePlans, courseIdParam]);

  const courseFixedCards = useMemo(() => {
    if (!fixedCourseFromSession?.stops?.length) return null;
    return homeCardsFromCourseStops(fixedCourseFromSession.stops);
  }, [fixedCourseFromSession]);

  const courseRestoreFailed = Boolean(
    courseIdParam && restoreDone && !fixedCourseFromSession?.stops?.length
  );

  useEffect(() => {
    if (courseRestoreFailed && courseIdParam) {
      logCourseDebug({
        event: "course_random_fallback_blocked",
        courseId: courseIdParam,
        fallbackBlocked: true,
        source: restoreSource,
      });
      logCourseRandomFallbackBlocked({ courseId: courseIdParam, restoreSource });
    }
  }, [courseRestoreFailed, courseIdParam, restoreSource]);

  const isCourseFixedResults = Boolean(courseFixedCards?.length) && !courseRestoreFailed;
  /**
   * 뷰티 URL: 코스 복원 실패/세션 고정 코스 등으로 `cards`를 덮어쓰지 않고 항상 `useHomeCards` 결과만 사용.
   * 그 외: 기존 코스·복원 분기 유지.
   */
  const primaryRecommendationCards: HomeCard[] = beautyUrlFinalGuard
    ? cards
    : courseRestoreFailed
      ? []
      : isCourseFixedResults && courseFixedCards
        ? courseFixedCards
        : cards;

  const primaryListCards = useMemo(() => {
    if (beautyUrlFinalGuard) {
      const whitelisted = primaryRecommendationCards.filter((c) => passesBeautyIndustryWhitelist(c));
      return whitelisted.length > 0 ? whitelisted : primaryRecommendationCards;
    }
    if (cultureUrlFinalGuard) {
      const whitelisted = primaryRecommendationCards.filter((c) => passesCultureIndustryWhitelist(c));
      return whitelisted.length > 0 ? whitelisted : primaryRecommendationCards;
    }
    return primaryRecommendationCards;
  }, [beautyUrlFinalGuard, cultureUrlFinalGuard, primaryRecommendationCards]);

  const secondaryListCards = useMemo(() => {
    if (beautyUrlFinalGuard) {
      const whitelisted = secondaryRecommendCards.filter((c) => passesBeautyIndustryWhitelist(c));
      return whitelisted.length > 0 ? whitelisted : secondaryRecommendCards;
    }
    if (cultureUrlFinalGuard) {
      const whitelisted = secondaryRecommendCards.filter((c) => passesCultureIndustryWhitelist(c));
      return whitelisted.length > 0 ? whitelisted : secondaryRecommendCards;
    }
    return secondaryRecommendCards;
  }, [beautyUrlFinalGuard, cultureUrlFinalGuard, secondaryRecommendCards]);

  const beautyV2HardMode = useMemo(
    () =>
      isBeautyV2HardMode({
        explicitCategory: resolvedExplicitCategoryForHome,
        explicitIntent: resolvedExplicitIntentForHome,
        recommendEngine,
        useRecommendV2Flag: USE_RECOMMEND_V2,
      }),
    [resolvedExplicitCategoryForHome, resolvedExplicitIntentForHome, recommendEngine]
  );

  useLayoutEffect(() => {
    const mapLite = (arr: HomeCard[]) =>
      arr.slice(0, 30).map((c) => ({
        name: c.name,
        category: c.category ?? null,
        categoryLabel: c.categoryLabel ?? null,
      }));
    const removedExamples = beautyUrlFinalGuard
      ? cards
          .filter((c) => !passesBeautyIndustryWhitelist(c))
          .slice(0, 8)
          .map((c) => ({
            name: c.name,
            category: c.category ?? null,
            categoryLabel: c.categoryLabel ?? null,
          }))
      : cultureUrlFinalGuard
        ? cards
            .filter((c) => !passesCultureIndustryWhitelist(c))
            .slice(0, 8)
            .map((c) => ({
              name: c.name,
              category: c.category ?? null,
              categoryLabel: c.categoryLabel ?? null,
            }))
        : [];
    console.log("[HAMA_RESULTS_LIST_FILTER_DEBUG]", {
      beautyUrlFinalGuard,
      cultureUrlFinalGuard,
      inputCards: mapLite(cards),
      afterPrimaryFilter: mapLite(primaryListCards),
      afterSecondaryFilter: mapLite(secondaryListCards),
      removedExamples,
    });
    console.log("[HAMA_RESULTS_TO_LIST]", {
      beautyV2HardMode,
      recommendEngine,
      primaryListCards,
      secondaryListCards,
    });
  }, [
    beautyUrlFinalGuard,
    cultureUrlFinalGuard,
    beautyV2HardMode,
    recommendEngine,
    cards,
    primaryListCards,
    secondaryListCards,
  ]);

  useEffect(() => {
    if (!isSoloSituationQuery) return;
    const blockedFoodPreset = "named_food_presets";
    const resolvedIntent =
      effectiveScenario?.scenario ?? resolvedExplicitIntentForHome ?? intent ?? "solo";
    const finalTop3 = primaryRecommendationCards.slice(0, 3).map((c) => ({
      name: c.name,
      category: String(c.category ?? c.categoryLabel ?? ""),
    }));
    hamaDevLog("[HAMA_SOLO_INTENT]", {
      query: qRaw,
      isSoloSituationQuery,
      matchedNamedFoodPreset: matchedNamedFoodPreset ? { id: matchedNamedFoodPreset.id, label: matchedNamedFoodPreset.label } : null,
      blockedFoodPreset,
      resolvedIntent,
      isLoading,
      finalTop3NamesCategories: finalTop3,
    });
  }, [
    isSoloSituationQuery,
    qRaw,
    matchedNamedFoodPreset,
    effectiveScenario?.scenario,
    resolvedExplicitIntentForHome,
    intent,
    primaryRecommendationCards,
    isLoading,
  ]);

  useEffect(() => {
    if (!convCtx?.sessionId || bootstrapBusy) return;
    if (placeLookupBusy) return;

    const hitIds = placeHits.slice(0, RECOMMEND_DECK_SIZE).map((c) => c.id);

    if (courseIdParam && fixedCourseFromSession?.stops?.length) {
      const ids = homeCardsFromCourseStops(fixedCourseFromSession.stops).map((c) => c.id);
      patchLastRecommendations(convCtx.sessionId, [...hitIds, ...ids].slice(0, 20));
      return;
    }
    if (effectiveMode === "course" && coursePlans.length > 0) {
      const ids = [...new Set(coursePlans.flatMap((p) => p.stops.map((s) => s.placeId)))];
      patchLastRecommendations(convCtx.sessionId, [...hitIds, ...ids].slice(0, 20));
      return;
    }
    const recIds = cards.map((c) => c.id);
    const merged = [...new Set([...hitIds, ...recIds])];
    if (merged.length === 0) return;
    patchLastRecommendations(convCtx.sessionId, merged.slice(0, 20));
  }, [
    convCtx?.sessionId,
    bootstrapBusy,
    placeLookupBusy,
    effectiveMode,
    coursePlans,
    cards,
    placeHits,
    courseIdParam,
    fixedCourseFromSession,
  ]);

  const logBase = useMemo(() => analyticsFromScenario(effectiveScenario), [effectiveScenario]);

  const isCourseMode = effectiveMode === "course";
  const isSituationResultsQuery = RESULTS_SITUATION_PRESET_QUERIES.has(qRaw.trim());
  const isScenarioRecommendationIntent = scenarioObject?.intentType === "scenario_recommendation";
  const showCourseDeck = Boolean(
    !pageBusy && isCourseMode && coursePlans.length > 0 && !showNameSearch && !courseIdParam
  );
  const courseFallbackActive = Boolean(
    !pageBusy && isCourseMode && coursePlans.length === 0 && !courseIdParam
  );
  const baseShowRecommendationList = Boolean(
    !pageBusy &&
      (beautyUrlFinalGuard ||
        (!courseRestoreFailed && (!isCourseMode || courseFallbackActive || isCourseFixedResults)))
  );
  const forceSituationRecommendationListVisible = Boolean(
    !pageBusy &&
      !courseRestoreFailed &&
      isSituationResultsQuery &&
      isScenarioRecommendationIntent &&
      primaryListCards.length > 0
  );
  const forceShowListByCards = cards.length > 0;
  const showRecommendationList =
    baseShowRecommendationList || forceSituationRecommendationListVisible || forceShowListByCards;
  const recommendationListVisible = showRecommendationList && primaryListCards.length > 0;
  const recommendationMode = scenarioObject?.intentType ?? effectiveScenario?.recommendationMode ?? effectiveMode;
  const baseShowEmptyState = Boolean(
    !bootstrapBusy &&
      !showNameSearch &&
      !pageBusy &&
      !showCourseDeck &&
      primaryListCards.length === 0 &&
      placeLookupDone
  );
  const showEmptyState = forceShowListByCards ? false : baseShowEmptyState;

  useEffect(() => {
    console.log("[empty state conflict check]", {
      qRaw,
      cardsCount: primaryListCards.length,
      placeSearchEnabled,
      showEmptyState,
      recommendationListVisible,
    });
    hamaDevLog("[HAMA_UI] recommendationListVisible:", recommendationListVisible);
    hamaDevLog("[HAMA_UI] cards.length:", cards.length);
    hamaDevLog("[HAMA_UI] recommendationMode:", recommendationMode);
    hamaDevLog("[HAMA_UI_FORCE]", {
      cardsLength: cards.length,
      showRecommendationList,
      showEmptyState,
    });
  }, [
    qRaw,
    cards.length,
    primaryListCards.length,
    placeSearchEnabled,
    showEmptyState,
    recommendationListVisible,
    recommendationMode,
    showRecommendationList,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isGenericFoodResultsQuery) return;
    const showEmptyState =
      !pageBusy &&
      !showNameSearch &&
      !showCourseDeck &&
      primaryRecommendationCards.length === 0 &&
      placeLookupDone;
    let renderedMode = "other";
    if (showCourseDeck) renderedMode = "course_deck";
    else if (showRecommendationList && primaryRecommendationCards.length > 0) renderedMode = "recommendation_list";
    else if (showEmptyState) renderedMode = "empty_message";
    console.log("[generic food results render]", {
      qRaw,
      placeSearchEnabled,
      effectiveMode,
      isCourseMode,
      primaryRecommendationCardsCount: primaryRecommendationCards.length,
      recommendationCardsCount: cards.length,
      showRecommendationList,
      showNameSearch,
      showEmptyState,
      renderedMode,
    });
  }, [
    isGenericFoodResultsQuery,
    qRaw,
    placeSearchEnabled,
    effectiveMode,
    isCourseMode,
    primaryRecommendationCards.length,
    cards.length,
    showRecommendationList,
    showNameSearch,
    showCourseDeck,
    pageBusy,
    placeLookupDone,
  ]);

  useEffect(() => {
    const renderedSource = showNameSearch
      ? (cards.length > 0 ? "mixed" : "search-by-name")
      : "homecards";
    hamaDevLog("[HAMA_SEARCH] route:", "results");
    hamaDevLog("[HAMA_SEARCH] query:", qRaw);
    console.log("[recommend path diagnosis]", {
      query: qRaw,
      placeSearchEnabled,
      placeSearchResultsCount: placeHits.length,
      homeCardsCount: cards.length,
      renderedSource,
    });
    console.log("[library results diagnosis]", {
      qRaw,
      placeSearchEnabled,
      placeSearchResultsCount: placeHits.length,
      homeCardsCount: cards.length,
      renderedSource,
      searchQueryForHomeCards,
      explicitIntent,
      explicitCategory,
    });
  }, [
    qRaw,
    placeSearchEnabled,
    placeHits.length,
    cards.length,
    showNameSearch,
    searchQueryForHomeCards,
    explicitIntent,
    explicitCategory,
  ]);

  const filteredCoursePlans = useMemo(() => {
    if (courseFilter === "all") return coursePlans;
    if (courseFilter === "food") {
      return coursePlans.filter((p) => p.stops.every((s) => s.placeType === "FOOD"));
    }
    if (courseFilter === "indoor") {
      return coursePlans.filter((p) => p.stops.every((s) => s.placeType !== "WALK"));
    }
    return coursePlans.filter((p) => p.totalMinutes <= 180);
  }, [coursePlans, courseFilter]);

  const scenarioBadge = /데이트|커플|연인/.test(qRaw) ? "💗 데이트" : "🎯 추천 코스";

  useEffect(() => {
    if (courseIdParam) return;
    if (pageBusy || effectiveMode !== "course" || isLoading) return;
    if (coursePlans.length > 0) return;
    setModeOverride("single");
    setShuffleKey((k) => k + 1);
  }, [courseIdParam, pageBusy, effectiveMode, isLoading, coursePlans.length]);

  const poolById = useMemo(() => new Map(candidatePool.map((c) => [c.id, c])), [candidatePool]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!qRaw || !scenarioObject || pageBusy) return;
    const courseExplain = explainCourseGenerationMatch(qRaw);
    console.log("[HAMA results]", {
      parsedIntentType: scenarioObject.intentType,
      recommendationMode: effectiveScenario?.recommendationMode,
      courseBranchRule: isCourseMode ? courseExplain.ruleId : null,
      coursePlanCount: isCourseMode ? coursePlans.length : null,
      courseFallbackRan: courseFallbackActive,
      recommendationCardCount: cards.length,
    });
  }, [
    qRaw,
    scenarioObject,
    effectiveScenario?.recommendationMode,
    pageBusy,
    isCourseMode,
    coursePlans.length,
    courseFallbackActive,
    cards.length,
  ]);

  const fallbackToRecommendation = Boolean(
    placeLookupDone && placeSearchEnabled && placeHits.length === 0 && !deferRecForPlaceLookup
  );

  useEffect(() => {
    if (!placeSearchEnabled) {
      if (process.env.NODE_ENV === "development") console.log("[FLOW 3] place search skipped (gate)");
      return;
    }
    if (placeSearchLoading) return;
    const placeResults = placeHits;
    if (process.env.NODE_ENV === "development") {
      console.log("[FLOW 1] placeResults =", placeResults);
      if (placeResults?.length > 0) {
        console.log("[FLOW 2] place search success -> main list hidden; secondary rec still fetched");
      } else {
        console.log("[FLOW 3] fallback to intent / recommendation");
      }
    }
  }, [placeSearchEnabled, placeSearchLoading, placeHits]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!qRaw) return;
    console.log("[search] query:", qRaw);
    console.log("[search] parsed intentType:", scenarioObject?.intentType ?? null);
    console.log("[search] placeNameSearch gate:", placeNameGate);
    console.log("[search] runPlaceNameSearch:", placeSearchEnabled);
    if (placeSearchEnabled) console.log("[search] runPlaceNameSearch called (fetch scheduled / in flight)");
    console.log("[search] placeSearch loading:", placeSearchLoading);
    console.log("[search] placeSearchResults.length:", placeHits.length);
    console.log("[search] matched places:", placeHits.map((p) => p.name));
    console.log("[search] place API meta:", placeSearchMeta);
    console.log("[search] fallback to recommendation:", fallbackToRecommendation);
    console.log("[search] showNameSearch (primary list):", showNameSearch);
  }, [
    qRaw,
    scenarioObject?.intentType,
    placeNameGate,
    placeSearchEnabled,
    placeSearchLoading,
    placeHits,
    placeSearchMeta,
    fallbackToRecommendation,
    showNameSearch,
  ]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (resultsFlowMode === "place_search" && placeHits.length > 0) {
      console.log("[RENDER FLOW] place_search dominant — SearchResultSection first; recommend fetch skipped");
    }
  }, [resultsFlowMode, placeHits.length]);

  const impressionLogged = useRef(false);
  const placeNameSearchLogged = useRef(false);
  const recommendDeckLogged = useRef(false);

  useEffect(() => {
    if (!qRaw || bootstrapBusy || placeLookupBusy) return;
    if (impressionLogged.current) return;
    impressionLogged.current = true;
    const latency_ms = Math.round(performance.now() - started.current);
    logEvent("result_impression", mergeLogPayload(logBase, { query: qRaw, latency_ms }));
  }, [qRaw, bootstrapBusy, placeLookupBusy, logBase]);

  useEffect(() => {
    if (!qRaw || pageBusy || showNameSearch) return;
    if (!showRecommendationList || primaryListCards.length === 0) return;
    if (recommendDeckLogged.current) return;
    recommendDeckLogged.current = true;
    const slice = primaryListCards.slice(0, RECOMMEND_DECK_SIZE);
    logEvent(
      HamaEvents.recommend_deck_impression,
      mergeLogPayload(logBase, {
        query: qRaw,
        place_ids: slice.map((c) => c.id),
        recommendation_voices: slice.map((c) => c.recommendationVoice ?? null),
        count: slice.length,
        page: "results",
        course_fixed: isCourseFixedResults,
      })
    );

    const recId = recommendSessionId;
    if (recId && effectiveScenario) {
      const now = new Date();
      logRecommendationEvent({
        event_name: "recommendation_impression",
        entity_type: null,
        entity_id: null,
        scenario: effectiveScenario.scenario ?? null,
        time_of_day: effectiveScenario.timeOfDay ?? null,
        weather_condition: (effectiveScenario as any).weatherCondition ?? null,
        source_page: "results",
        place_ids: slice.map((c) => c.id),
        metadata: {
          query: qRaw,
          recommendation_voices: slice.map((c) => c.recommendationVoice ?? null),
          course_fixed: isCourseFixedResults,
        },
        analytics_v2: {
          recommendation_id: recId,
          category_clicked: intentCategoryToCategoryClicked(effectiveScenario.intentCategory),
          user_profile: (mergedProfileForRanking ?? {}) as unknown as Record<string, unknown>,
          shown_place_ids: slice.map((c) => c.id),
          main_pick_id: slice[0]?.id ?? null,
          recommendation_reasons: {
            items: slice.map((c) => ({
              id: c.id,
              name: c.name,
              voice: c.recommendationVoice ?? null,
              reasonText: c.reasonText ?? null,
              breakdown: (c as any).recommendationScoreBreakdown ?? null,
            })),
          },
          weights: hybridWeightsForLog,
          scenario: effectiveScenario.scenario,
          weather: (effectiveScenario as any).weatherCondition ?? effectiveScenario.weatherHint ?? null,
          day_of_week: now.getDay(),
          time_of_day: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        },
      });
    }
  }, [
    qRaw,
    pageBusy,
    showNameSearch,
    showRecommendationList,
    primaryListCards,
    isCourseFixedResults,
    logBase,
    effectiveScenario,
    mergedProfileForRanking,
    hybridWeightsForLog,
    recommendSessionId,
  ]);

  useEffect(() => {
    if (!showNameSearch) return;
    if (placeNameSearchLogged.current) return;
    placeNameSearchLogged.current = true;
    logEvent("place_name_search_impression", mergeLogPayload(logBase, { query: qRaw, hit_count: placeHits.length }));
  }, [showNameSearch, qRaw, placeHits.length, logBase]);

  useEffect(() => {
    impressionLogged.current = false;
    placeNameSearchLogged.current = false;
    recommendDeckLogged.current = false;
  }, [qRaw, shuffleKey]);

  const applyNewQuery = (next: string, src?: string) => {
    const t = next.trim();
    if (!t) return;
    recordRecentIntent(t);
    logEvent("search_submit", mergeLogPayload(parseScenarioIntent(t), { query: t, source: src ?? "results" }));
    router.push(`/results?q=${encodeURIComponent(t)}`);
  };

  const getLatLng = (card: HomeCard) => {
    const a = card as any;
    const lat = typeof a.lat === "number" ? a.lat : undefined;
    const lng = typeof a.lng === "number" ? a.lng : undefined;
    return { lat, lng };
  };

  const strictHint =
    effectiveScenario?.intentType === "search_strict" &&
    !isCourseMode &&
    !showNameSearch &&
    !isCourseFixedResults &&
    primaryListCards.length > 0 &&
    primaryListCards.length < RECOMMEND_DECK_SIZE;

  const showSoftFallbackCopy = Boolean(
    strictHint || deckIncomplete || rejectedMainPickIds.length > 0
  );
  const strictBeautyEmpty =
    effectiveScenario?.intentType === "search_strict" &&
    effectiveScenario?.intentCategory === "BEAUTY";

  const rejectMainAndRefresh = () => {
    const id = primaryListCards[0]?.id;
    if (!id) return;
    const recId = recommendSessionId;
    if (recId && effectiveScenario) {
      logRecommendationEvent({
        event_name: "reject_main_pick",
        entity_type: "place",
        entity_id: id,
        scenario: effectiveScenario.scenario ?? null,
        source_page: "results",
        place_ids: [id],
        metadata: { query: qRaw },
        analytics_v2: {
          recommendation_id: recId,
          action: "reject",
          selected_place_id: id,
          category_clicked: intentCategoryToCategoryClicked(effectiveScenario.intentCategory),
          user_profile: (mergedProfileForRanking ?? {}) as unknown as Record<string, unknown>,
          scenario: effectiveScenario.scenario,
        },
      });
    }
    setRejectedMainPickIds((prev) => [...new Set([...prev, id])]);
    setShuffleKey((k) => k + 1);
  };

  const headerLoading = bootstrapBusy || (placeLookupBusy && !showNameSearch);

  if (DEBUG_FORCE_SEARCH_SECTION) {
    const debugResults: HomeCard[] = [{ id: "debug-1", name: "두부마을", category: null }];
    if (process.env.NODE_ENV === "development") {
      console.log("[DEBUG_FORCE_SEARCH_SECTION] stub results only — UI/분기 단독 검증");
    }
    return (
      <main
        style={{
          minHeight: "100vh",
          paddingBottom: 100,
          background: `linear-gradient(180deg, ${colors.bgDefault} 0%, ${colors.bgMuted} 100%)`,
        }}
      >
        <div style={{ maxWidth: 430, margin: "0 auto", padding: `16px ${space.pageX}px 0` }}>
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              border: "none",
              background: "transparent",
              color: colors.accentPrimary,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              marginBottom: 8,
              padding: 0,
            }}
          >
            ← 홈으로
          </button>
          <SearchResultSection
            results={debugResults}
            scenarioObject={null}
            logBase={analyticsFromScenario(null)}
            onRecordView={() => {}}
          />
        </div>
      </main>
    );
  }

  if (!courseIdParam && !queryForScenario) return null;

  if (courseIdParam && !restoreDone) {
    return (
      <main style={{ minHeight: "100vh", padding: 24, background: colors.bgDefault }}>
        <p style={{ color: colors.textSecondary }}>코스를 불러오는 중…</p>
      </main>
    );
  }

  if (courseRestoreFailed) {
    return (
      <main style={{ minHeight: "100vh", padding: 24, background: colors.bgDefault }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            border: "none",
            background: "transparent",
            color: colors.accentPrimary,
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            marginBottom: 16,
            padding: 0,
          }}
        >
          ← 이전 화면
        </button>
        <p style={{ fontSize: 16, lineHeight: 1.5, color: colors.textPrimary, marginBottom: 12 }}>
          선택한 코스를 다시 불러오지 못했어요. 이전 화면으로 돌아가 다시 선택해 주세요.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            padding: "12px 20px",
            borderRadius: 12,
            border: "none",
            background: colors.accentPrimary,
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          홈으로
        </button>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        paddingBottom: 100,
        background: `linear-gradient(180deg, ${colors.bgDefault} 0%, ${colors.bgMuted} 100%)`,
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: `16px ${space.pageX}px 0` }}>
        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            border: "none",
            background: "transparent",
            color: colors.accentPrimary,
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            marginBottom: 8,
            padding: 0,
          }}
        >
          ← 홈으로
        </button>
        <ResultsHeader isLoading={headerLoading} />
        <ActiveConstraintChips chips={constraintChips} />

        {strictHint && (
          <p style={{ fontSize: 13, color: colors.textSecondary, margin: "0 0 16px", lineHeight: 1.45 }}>
            조건에 딱 맞는 곳이 적어서 가장 비슷한 선택으로 골랐어
          </p>
        )}

        {bootstrapBusy && (
          <div style={{ padding: 40, textAlign: "center", color: colors.textSecondary }}>골라보는 중…</div>
        )}

        {!bootstrapBusy && placeLookupBusy && (
          <p style={{ padding: "8px 0 16px", textAlign: "center", color: colors.textSecondary, fontSize: 14 }}>
            이름으로 매장 찾는 중…
          </p>
        )}

        {!bootstrapBusy && placeLookupDone && showNameSearch && (
          <SearchResultSection
            results={placeHits}
            scenarioObject={effectiveScenario}
            logBase={logBase}
            onRecordView={(id) => recordView(id)}
          />
        )}

        {!bootstrapBusy && showNameSearch && isLoading && (
          <p style={{ fontSize: 13, color: colors.textSecondary, margin: "0 0 16px" }}>비슷한 곳도 골라보는 중…</p>
        )}

        {!bootstrapBusy &&
          showNameSearch &&
          !isLoading &&
          secondaryListCards.length > 0 && (
            <section style={{ marginBottom: space.section }}>
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: colors.textPrimary,
                  margin: "0 0 12px",
                  letterSpacing: "-0.02em",
                }}
              >
                이런 곳도 있어
              </h2>
              {namedFoodPresetIdForListRef?.id === "chinese" && (
                <p style={{ fontSize: 13, color: colors.textSecondary, margin: "0 0 10px", lineHeight: 1.45 }}>
                  중식으로 보기 좋은 곳을 골랐어요
                </p>
              )}
              <RecommendationList
                cards={secondaryListCards}
                scenarioObject={effectiveScenario}
                namedFoodPresetId={namedFoodPresetIdForListRef?.id}
                deckRotationKey={matchedNamedFoodPreset ? deckRotationKey : null}
                recommendEngine={recommendEngine}
                beautyUrlFinalGuard={beautyUrlFinalGuard}
                cultureUrlFinalGuard={cultureUrlFinalGuard}
                beautyV2HardMode={beautyV2HardMode}
                explicitCategory={resolvedExplicitCategoryForHome}
                explicitIntent={resolvedExplicitIntentForHome}
                analyticsV2Click={analyticsV2Base ?? undefined}
                showSoftFallbackCopy={false}
                resultsSurface="secondary"
                isLoggedIn={isLoggedIn}
                onRequireLogin={requireKakaoLogin}
                onPlaceClick={(card, rank) => {
                  logEvent(
                    "place_click",
                    mergeLogPayload(logBase, { place_id: card.id, name: card.name, card_rank: rank, source: "secondary_recommend" })
                  );
                  stashPlaceForSession(card);
                  router.push(`/place/${encodeURIComponent(card.id)}`);
                }}
                onNavigate={(card, rank) => {
                  logEvent("navigate_click", mergeLogPayload(logBase, { place_id: card.id, card_rank: rank }));
                  const { lat, lng } = getLatLng(card);
                  openDirections({ name: card.name, lat: lat ?? null, lng: lng ?? null });
                }}
                onCall={(card, rank) => {
                  const tel = String(card.phone ?? "").replace(/[^0-9+]/g, "");
                  logEvent("call_click", mergeLogPayload(logBase, { place_id: card.id, card_rank: rank }));
                  if (tel) window.location.href = `tel:${tel}`;
                }}
              />
            </section>
          )}

        {!bootstrapBusy &&
          placeSearchEnabled &&
          placeLookupDone &&
          !showNameSearch &&
          !pageBusy &&
          !showCourseDeck &&
          primaryListCards.length > 0 && (
            <p style={{ fontSize: 13, color: colors.textSecondary, margin: "0 0 12px", lineHeight: 1.45 }}>
              같은 이름의 매장은 못 찾았어. 대신 이런 곳은 어때?
            </p>
          )}

        {showEmptyState && (
            <p style={{ color: colors.textSecondary }}>
              {tonkatsuRecommendDisabled
                ? "검색 결과가 부족해요. 검색어를 조금 바꿔 보거나 다른 지역으로 시도해 보세요."
                : matchedNamedFoodPreset
                  ? "조건에 맞는 식당을 찾기 어려워요. 검색 결과가 부족해요 — 검색어를 조금 바꿔 보거나 다른 지역으로 시도해 보세요."
                  : strictBeautyEmpty
                    ? "이 지역에 매장이 적어요"
                    : placeSearchEnabled
                      ? "이름으로는 찾지 못했어. 다른 말로 한 번만 더 말해줄래?"
                      : "지금은 보여줄 카드가 없어. 다른 말로 한 번만 더 말해줄래?"}
            </p>
          )}

        {courseFallbackActive && !showNameSearch && primaryListCards.length > 0 && (
          <p
            style={{
              fontSize: 14,
              color: colors.textPrimary,
              margin: "0 0 14px",
              lineHeight: 1.5,
              fontWeight: 700,
            }}
          >
            조건에 맞는 코스가 부족해서, 먼저 갈 만한 곳을 골라봤어. 코스로 묶기엔 데이터가 부족할 때도 있어 — 아래에서 이어 보면 돼.
          </p>
        )}

        {!pageBusy && !showNameSearch && showRecommendationList && primaryListCards.length > 0 && (
          <>
            {matchedNamedFoodPreset?.id === "chinese" && (
              <p style={{ fontSize: 14, color: colors.textPrimary, margin: "0 0 10px", lineHeight: 1.5 }}>
                중식으로 보기 좋은 곳을 골랐어요
              </p>
            )}
            <RecommendationList
              cards={primaryListCards}
              scenarioObject={effectiveScenario}
              namedFoodPresetId={namedFoodPresetIdForListRef?.id}
              deckRotationKey={matchedNamedFoodPreset ? deckRotationKey : null}
              recommendEngine={recommendEngine}
              beautyUrlFinalGuard={beautyUrlFinalGuard}
              cultureUrlFinalGuard={cultureUrlFinalGuard}
              beautyV2HardMode={beautyV2HardMode}
              explicitCategory={resolvedExplicitCategoryForHome}
              explicitIntent={resolvedExplicitIntentForHome}
              analyticsV2Click={analyticsV2Base ?? undefined}
              showSoftFallbackCopy={showSoftFallbackCopy}
              isLoggedIn={isLoggedIn}
              onRequireLogin={requireKakaoLogin}
              onPlaceClick={(card, rank) => {
                logEvent("place_click", mergeLogPayload(logBase, { place_id: card.id, name: card.name, card_rank: rank }));
                stashPlaceForSession(card);
                router.push(`/place/${encodeURIComponent(card.id)}`);
              }}
              onNavigate={(card, rank) => {
                logEvent("navigate_click", mergeLogPayload(logBase, { place_id: card.id, card_rank: rank }));
                const { lat, lng } = getLatLng(card);
                openDirections({ name: card.name, lat: lat ?? null, lng: lng ?? null });
              }}
              onCall={(card, rank) => {
                const tel = String(card.phone ?? "").replace(/[^0-9+]/g, "");
                logEvent("call_click", mergeLogPayload(logBase, { place_id: card.id, card_rank: rank }));
                if (tel) window.location.href = `tel:${tel}`;
              }}
            />
          </>
        )}

        {!pageBusy &&
          !showNameSearch &&
          showRecommendationList &&
          primaryListCards.length > 0 &&
          !isCourseFixedResults && (
            <div
              style={{
                marginTop: 12,
                borderRadius: radius.button,
                border: `1.5px dashed ${colors.accentPrimary}`,
                background: colors.primaryLight,
                padding: 10,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                value={retryInput}
                onChange={(e) => setRetryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const t = retryInput.trim();
                    if (!t) return;
                    rejectMainAndRefresh();
                    applyNewQuery(t, "retry_input");
                    setRetryInput("");
                  }
                }}
                placeholder="맘에 안들면 여기 적어줘"
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  border: `1px solid ${colors.borderSubtle}`,
                  padding: "0 12px",
                  fontSize: 14,
                  outline: "none",
                  background: "#fff",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const t = retryInput.trim();
                  if (!t) return;
                  rejectMainAndRefresh();
                  applyNewQuery(t, "retry_input");
                  setRetryInput("");
                }}
                style={{
                  height: 40,
                  borderRadius: 10,
                  border: "none",
                  padding: "0 14px",
                  background: colors.accentPrimary,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                다시 찾기
              </button>
            </div>
          )}

        {!pageBusy && showCourseDeck && (
          <section style={{ marginBottom: space.section }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: colors.textSecondary,
                  background: colors.primaryLight,
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: 999,
                  padding: "6px 10px",
                }}
              >
                {scenarioBadge}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: colors.textSecondary }}>3가지 코스</span>
            </div>
            <h2 style={{ margin: "0 0 10px", fontSize: 28, lineHeight: 1.18, letterSpacing: "-0.03em", color: colors.textPrimary }}>
              오늘 둘이서, <span style={{ background: `linear-gradient(transparent 62%, ${colors.primaryLight} 62%)` }}>이런 코스 어때?</span>
            </h2>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {[
                { id: "all", label: "전체" },
                { id: "food", label: "식당만" },
                { id: "indoor", label: "실내 위주" },
                { id: "under3h", label: "3시간 이내" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCourseFilter(f.id as typeof courseFilter)}
                  style={{
                    border: `1px solid ${courseFilter === f.id ? colors.accentPrimary : colors.borderSubtle}`,
                    background: courseFilter === f.id ? colors.primaryLight : "#fff",
                    color: courseFilter === f.id ? colors.accentPrimary : colors.textSecondary,
                    borderRadius: 999,
                    padding: "7px 11px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: space.card }}>
              {(filteredCoursePlans.length ? filteredCoursePlans : coursePlans).slice(0, 3).map((plan, i) => {
              const first = plan.stops[0];
              const thumbCard = first ? poolById.get(first.placeId) ?? null : null;
              return (
                <CourseDeckCard
                  key={plan.id}
                  plan={plan}
                  rank={i}
                  thumbCard={thumbCard}
                  badges={plan.badges}
                  logExtras={logBase}
                  scenarioObject={effectiveScenario}
                  onReserveAndStart={undefined}
                  onViewCourseOnly={() => {
                    const merged = { ...plan, sourceQuery: qRaw || plan.sourceQuery };
                    stashCoursePlan(merged);
                    const snap = encodeCoursePlanSnapshot(merged);
                    const maxQuerySnap = 4500;
                    const useHashOnly = snap.length > maxQuerySnap;
                    const snapQuery = !useHashOnly ? `&courseSnap=${encodeURIComponent(snap)}` : "";
                    const hashPart = useHashOnly ? `#hamaCourseSnap=${encodeURIComponent(snap)}` : "";
                    logCourseDebug({
                      event: "course_click_start",
                      courseId: plan.id,
                      stepIds: plan.stops.map((s) => s.placeId),
                      extra: {
                        from: "results_deck",
                        intent: "view_only",
                        ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
                        snap_in_url: !useHashOnly,
                        snap_in_hash: useHashOnly,
                      },
                    });
                    logEvent("home_course_pick", mergeLogPayload(logBase, { course_id: plan.id, cta: "view_only" }));
                    router.push(`/course?id=${encodeURIComponent(plan.id)}${snapQuery}${hashPart}`);
                  }}
                  onNavigateFirst={() => {
                    if (!first) return;
                    logEvent("navigate_click", mergeLogPayload(logBase, { course_id: plan.id, card_rank: i }));
                    openDirections({ name: first.placeName, lat: first.lat ?? null, lng: first.lng ?? null });
                  }}
                />
              );
            })}
            </div>

          </section>
        )}

        {!bootstrapBusy && !placeLookupBusy && !placeSearchDominant && (
          <NextSuggestions
            scenarioObject={effectiveScenario}
            suggestionOptions={courseFallbackActive ? { courseFallback: true } : undefined}
            onSelect={(nq) => applyNewQuery(nq, "next_suggestion")}
          />
        )}

        <FeedbackFab />
      </div>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: colors.bgDefault,
          }}
        >
          로딩…
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
