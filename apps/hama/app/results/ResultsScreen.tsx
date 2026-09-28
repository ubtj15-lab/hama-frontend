"use client";

/** Shared results experience. `/results` renders this; the home route does not. */

import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useHomeCards } from "@/_hooks/useHomeCards";
import { useHomeMode } from "@/_hooks/useHomeMode";
import { useRecent } from "@/_hooks/useRecent";
import { useResultsRecommendationDeck } from "@/_hooks/useResultsRecommendationDeck";
import { normalizeBrandQuery } from "@/lib/results/placeNameSearchIntent";
import { logDirectSearchPipeline } from "@/lib/search/directSearch";
import {
  assembleResultsCardLists,
  RECOMMEND_DATA_UNAVAILABLE_MESSAGE,
  resolveResultsDataNotice,
} from "@/lib/results/resultsRecommendationDeck";
import {
  parseScenarioIntent,
  explainCourseGenerationMatch,
} from "@/lib/scenarioEngine/parseScenarioIntent";
import {
  loadConversationContext,
  processConversationTurn,
  summarizeActiveConstraints,
  patchLastRecommendations,
  recordShownPlayCards,
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
import { mergeExcludeForDisplayedDeck } from "@/lib/recommend/fallbackRecommend";
import { readContextRecentExposedIds } from "@/lib/recommend/recentExposure";
import {
  repeatAvoidanceContextKey,
  shouldApplyHomeSituationRepeatAvoidance,
} from "@/lib/recommend/dateRepeatAvoidance";
import { classifyDiscoveryQuery } from "@/lib/recommend/discoveryRole";
import {
  isSoloSituationIntentQuery,
  matchNamedFoodPreset,
  matchesTonkatsuBetaDisabledQuery,
} from "@/lib/recommend/namedFoodPresets";
import { ResultsHeader } from "@/_components/results/ResultsHeader";
import { RESULTS_CONTENT_MAX_WIDTH } from "@/_components/results/resultsPresentation";
import { ActiveConstraintChips } from "@/_components/results/ActiveConstraintChips";
import { RecommendationList } from "@/_components/results/RecommendationList";
import { OpenExplorationMapButton } from "@/map/OpenExplorationMapButton";
import { ResultsConversation } from "@/_components/results/ResultsConversation";
import { composeAssistantReply, persistAssistantReply } from "@/lib/conversation/assistantReply";
import { recordDialogueSnapshot } from "@/lib/conversation/storage";
import { type HomeResume } from "@/lib/conversation/homeResume";
import { filterCardsByNamedRegion } from "@/lib/conversation/namedRegion";
import { buildLinkedFoodScenario, detectLinkedFoodPurpose, resolveFoodAnchor, validShownPlayCards } from "@/lib/conversation/linkedPurpose";
import { storeCategoryMatchesIntentCategory } from "@/lib/scenarioEngine/intentClassification";
import { LinkedFoodGroup } from "@/_components/results/LinkedFoodGroup";
import { HamaConversationView } from "@/_components/home/HamaConversationView";
import { SUPPRESSION_UNAVAILABLE_MESSAGE } from "@/lib/recommend/storeSuppression";
import { SearchResultSection } from "@/_components/results/SearchResultSection";
import { CourseDeckCard } from "@/_components/results/CourseDeckCard";
import { NextSuggestions } from "@/_components/results/NextSuggestions";
import { colors, radius, space } from "@/lib/designTokens";
import { logEvent } from "@/lib/logEvent";
import { HamaEvents } from "@/lib/analytics/events";
import {
  claimConversationTurnOutcome,
  CONVERSATION_TURN_OUTCOME_SCREEN,
  resolveConversationTurnOutcome,
} from "@/lib/analytics/conversationTurnOutcome";
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
import { logContextualRejectFeedback } from "@/lib/analytics/logContextualRejectFeedback";
import { createRecommendationSessionId } from "@/lib/analytics/recommendationSessionIdentity";
import {
  buildRecommendationSessionSnapshot,
  mergeImpressionHistory,
} from "@/lib/analytics/recommendationSessionSnapshot";
import { RECOMMENDATION_ENGINE_VERSION } from "@/lib/analytics/recommendationEngineVersion";
import type { RecommendationRejectReason } from "@/lib/analytics/recommendationRejectReasons";
import { ContextualRejectReasonBar } from "@/_components/results/ContextualRejectReasonBar";
import {
  buildFrozenContextualRejectPayload,
  freezeContextualRejectContext,
  type FrozenContextualReject,
} from "@/_components/results/contextualRejectLifecycle";
import { parseUserProfile, type UserProfile } from "@/lib/onboardingProfile";
import { hamaDevLog } from "@/lib/hamaDevLog";
import { mergeResultsScenarioWithExplicitNav, normalizeResultsExplicitCategory, passesBeautyIndustryWhitelist, passesCultureIndustryWhitelist, strictExplicitGateCategoryFromUrl } from "@/lib/hamaResultCategoryCanonical";
import { USE_RECOMMEND_V2 } from "@/lib/recommend-v2/recommendV2Flags";
import { isBeautyUrlFromExplicitNav, isBeautyV2HardMode } from "@/lib/recommend-v2/beautyV2HardMode";
import { shouldApplyCultureStrictWhitelist } from "@/lib/recommend-v2/normalizeRequest";
import { useHamaMe } from "@/lib/auth/useHamaMe";
import { kakaoLoginUrl } from "@/lib/auth/kakaoLogin";
import {
  intentCategoryToCategoryClicked,
  isFamilyDiningAliasQuery as matchFamilyDiningAliasQuery,
  isGenericFoodResultsQuery as matchGenericFoodResultsQuery,
  isSituationResultsQuery as matchSituationResultsQuery,
  resolveSearchQueryForHomeCards,
} from "@/lib/results/resultsQueryRouting";

/** 결과 페이지만: 고정 더미로 SearchResultSection/분기 검증 — `.env.local` 에 `NEXT_PUBLIC_DEBUG_FORCE_SEARCH_SECTION=1` */
const DEBUG_FORCE_SEARCH_SECTION = process.env.NEXT_PUBLIC_DEBUG_FORCE_SEARCH_SECTION === "1";

function ResultsContent({
  embedded = false,
  utterance = null,
  resume = null,
}: {
  embedded?: boolean;
  utterance?: { id: string; text: string } | null;
  resume?: HomeResume | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseIdFromSearch = searchParams.get("courseId")?.trim() ?? "";
  const courseSnapFromSearch = searchParams.get("courseSnap")?.trim() ?? "";
  const urlQuery = searchParams.get("q")?.trim() ?? "";
  const qRaw = embedded ? (utterance?.text.trim() ?? "") : urlQuery;
  const holdTranscript = Boolean(embedded && resume && utterance?.id && resume.turnId === utterance.id);
  const transcriptRef = useRef<{ scrollTop: number; opened: Record<string, boolean>; selected: Record<string, number> } | null>(null);
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
  const [refreshingDeck, setRefreshingDeck] = useState(false);
  const [sessionRepeatAvoidIds, setSessionRepeatAvoidIds] = useState<string[]>(() => {
    const parsed = parseScenarioIntent(qRaw);
    return readContextRecentExposedIds(repeatAvoidanceContextKey(qRaw, parsed.scenario));
  });
  const [contextualReject, setContextualReject] = useState<FrozenContextualReject | null>(null);
  const [courseFilter, setCourseFilter] = useState<"all" | "food" | "indoor" | "under3h">("all");
  const [retryInput, setRetryInput] = useState("");
  const started = useRef<number>(0);
  const rankingSeenForQuery = useRef("");
  const preserveAssistantRef = useRef(false);
  const frozenPlayRef = useRef<HomeCard[] | null>(null);
  const awaitingRefreshBusy = useRef(false);
  const [modeOverride, setModeOverride] = useState<RecommendationMode | null>(null);

  const [convCtx, setConvCtx] = useState<ConversationContext | null>(null);
  const [foodAnchorId, setFoodAnchorId] = useState<string | null>(null);

  const [serverProfile, setServerProfile] = useState<UserProfile | null>(null);
  const [profileOverride, setProfileOverride] = useState<Partial<UserProfile> | null>(null);
  const [scenarioPatch, setScenarioPatch] = useState<Partial<ScenarioObject> | null>(null);
  const [relaxPersonalRules, setRelaxPersonalRules] = useState(false);
  /** Observability-only decision session. Not an input to ranking/shuffle. */
  const recommendSessionIdRef = useRef<string | null>(null);
  const [recommendSessionId, setRecommendSessionId] = useState<string | null>(null);
  const sessionHistoryRef = useRef<Record<string, unknown>>({});
  const [sessionHistory, setSessionHistory] = useState<Record<string, unknown>>({});
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
    setContextualReject(null);
    preserveAssistantRef.current = false;
    frozenPlayRef.current = null;
    awaitingRefreshBusy.current = false;
    setRefreshingDeck(false);
  }, [qRaw]);

  useEffect(() => {
    const parsed = parseScenarioIntent(qRaw);
    const key = repeatAvoidanceContextKey(qRaw, parsed.scenario);
    setSessionRepeatAvoidIds(readContextRecentExposedIds(key));
  }, [qRaw]);

  useEffect(() => {
    const q = queryForScenario;
    if (!q && !courseIdParam) {
      setConvCtx(null);
      return;
    }
    if (!q) return;
    const prev = loadConversationContext();
    setConvCtx(processConversationTurn(q, prev, embedded && utterance?.id ? { turnId: utterance.id } : undefined));
  }, [queryForScenario, courseIdParam, embedded, utterance?.id]);

  const turnRefreshKey = embedded ? (utterance?.id ?? "") : qRaw;
  useEffect(() => {
    started.current = performance.now();
    setShuffleKey((k) => k + 1);
  }, [turnRefreshKey]);

  useEffect(() => {
    // Observability only: new decision session when the raw query changes.
    // Shuffle / reject refresh (shuffleKey) must keep the same id and must not feed ranking.
    recommendSessionIdRef.current = createRecommendationSessionId();
    setRecommendSessionId(recommendSessionIdRef.current);
    sessionHistoryRef.current = {};
    setSessionHistory({});
  }, [qRaw]);

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
  const searchQueryForHomeCards = useMemo(
    () =>
      resolveSearchQueryForHomeCards({
        qRaw,
        explicitCategory,
        isSoloSituationQuery,
        hasNamedFoodPreset: Boolean(matchedNamedFoodPreset),
      }),
    [qRaw, explicitCategory, matchedNamedFoodPreset, isSoloSituationQuery]
  );

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
    () => matchFamilyDiningAliasQuery(qRaw, qNormalizedForIntent),
    [qRaw, qNormalizedForIntent]
  );
  const isGenericFoodResultsQuery = useMemo(
    () => matchGenericFoodResultsQuery(qNormalizedForIntent),
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

  const savedPlayCards = validShownPlayCards(convCtx?.frozenPlayCards)
    ? convCtx.frozenPlayCards
    : validShownPlayCards(convCtx?.lastRecommendations?.cards)
      ? convCtx.lastRecommendations!.cards!
      : null;
  const mealKeepsPlay = detectLinkedFoodPurpose(qRaw) && savedPlayCards != null;

  const {
    placeNameGate,
    directSearchMode,
    placeSearchEnabled,
    placeHits,
    placeSearchLoading,
    placeSearchMeta,
    deferRecForPlaceLookup,
    resultsFlowMode,
    cards,
    deckRotationKey,
    recommendEngine,
    candidatePool,
    courseCandidatePool,
    isLoading,
    deckIncomplete,
    recommendationBlocked,
    recommendationLoadFailed,
    bootstrapBusy,
    pageBusy,
    placeLookupBusy,
    placeLookupDone,
    showNameSearch,
    placeSearchDominant,
    nameSearchBlocked,
    nameSearchFailed,
  } = useResultsRecommendationDeck({
    qRaw,
    hasNamedFoodPreset: Boolean(matchedNamedFoodPreset),
    isSoloSituationQuery,
    userLat: userLoc?.lat,
    userLng: userLoc?.lng,
    shuffleKey,
    intentForHomeCards,
    rankingBootstrapReady,
    recentExcludeIds,
    rejectedMainPickIds,
    repeatAvoidPlaceIds: sessionRepeatAvoidIds,
    profileOverride,
    relaxPersonalRules,
    searchQuery: searchQueryForHomeCards,
    scenarioObject: scenarioObjectForHomeCards,
    courseIdParam,
    tonkatsuRecommendDisabled,
    skipFetchExtra: mealKeepsPlay || holdTranscript,
    retainCardsOnSkip: mealKeepsPlay,
    explicitIntent: resolvedExplicitIntentForHome,
    explicitCategory: resolvedExplicitCategoryForHome,
    explicitMode: resolvedModeForHome,
    namedFoodPreset: matchedNamedFoodPreset,
  });

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
  const { primaryRecommendationCards, primaryListCards, secondaryListCards } = useMemo(
    () =>
      assembleResultsCardLists({
        cards,
        placeHits,
        directSearchMode,
        beautyUrlFinalGuard,
        cultureUrlFinalGuard,
        courseRestoreFailed,
        isCourseFixedResults,
        courseFixedCards,
        narrowPrimaryList: (list) => {
          const regional = filterCardsByNamedRegion(list, effectiveScenario?.region);
          if (effectiveScenario?.intentCategory !== "ACTIVITY") return regional;
          return regional.filter((card) => storeCategoryMatchesIntentCategory(card, "ACTIVITY"));
        },
      }),
    [
      cards,
      placeHits,
      directSearchMode,
      beautyUrlFinalGuard,
      cultureUrlFinalGuard,
      courseRestoreFailed,
      isCourseFixedResults,
      courseFixedCards,
      effectiveScenario?.region,
      effectiveScenario?.intentCategory,
    ]
  );

  const linkedFoodActive = Boolean(convCtx?.linkedPurposes?.some((item) => item.intentCategory === "FOOD"));
  const linkedFoodScenario = useMemo(() => {
    if (!linkedFoodActive || !scenarioObject) return null;
    return buildLinkedFoodScenario(scenarioObject, /근처|가까운|가까이/.test(qRaw));
  }, [linkedFoodActive, scenarioObject, qRaw]);
  const displayedPlayCards = mealKeepsPlay && savedPlayCards ? savedPlayCards : primaryListCards;
  const freshPlayCards = rejectedMainPickIds.length
    ? primaryListCards.filter((card) => card.id && !rejectedMainPickIds.includes(card.id))
    : primaryListCards;
  const conversationPlayCards =
    mealKeepsPlay && savedPlayCards
      ? savedPlayCards
      : refreshingDeck && frozenPlayRef.current
        ? frozenPlayRef.current
        : freshPlayCards;

  useEffect(() => {
    if (!refreshingDeck) return;
    if (pageBusy || isLoading) {
      awaitingRefreshBusy.current = true;
      return;
    }
    if (!awaitingRefreshBusy.current) return;
    awaitingRefreshBusy.current = false;
    frozenPlayRef.current = null;
    setRefreshingDeck(false);
  }, [refreshingDeck, pageBusy, isLoading]);
  const foodAnchorPick = resolveFoodAnchor(displayedPlayCards, foodAnchorId);
  const foodAnchor = foodAnchorPick.card;
  const foodAnchorLat = typeof foodAnchor?.lat === "number" ? foodAnchor.lat : null;
  const foodAnchorLng = typeof foodAnchor?.lng === "number" ? foodAnchor.lng : null;
  const foodScenarioForFetch = linkedFoodScenario
    ? { ...linkedFoodScenario, conversationExcludePlaceIds: undefined }
    : null;
  const {
    cards: linkedFoodCards,
    isLoading: linkedFoodLoading,
    recommendationBlocked: foodRecommendationBlocked,
    recommendationLoadFailed: foodRecommendationLoadFailed,
  } = useHomeCards("all", shuffleKey, "none", {
    userLat: foodAnchorLat,
    userLng: foodAnchorLng,
    excludeStoreIds: [],
    searchQuery: foodScenarioForFetch?.region ? `${foodScenarioForFetch.region} 식당` : "식당",
    scenarioObject: foodScenarioForFetch,
    skipFetch: !foodScenarioForFetch || holdTranscript,
    deferRanking: !foodScenarioForFetch || holdTranscript,
  });
  const foodRestaurantCards = useMemo(
    () => (linkedFoodCards ?? []).filter((card) => storeCategoryMatchesIntentCategory(card, "FOOD")),
    [linkedFoodCards]
  );
  const foodNearNeedsAnchor = false;
  const foodAnchorProvisional = foodAnchorPick.provisional;
  const foodMissingCoords = Boolean(linkedFoodActive && !foodAnchor);

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
    const recIds = displayedPlayCards.map((c) => c.id);
    const merged = [...new Set([...hitIds, ...recIds])];
    if (merged.length === 0) return;
    patchLastRecommendations(convCtx.sessionId, merged.slice(0, 20), qRaw, displayedPlayCards, embedded ? utterance?.id : undefined);
  }, [
    convCtx?.sessionId,
    bootstrapBusy,
    placeLookupBusy,
    effectiveMode,
    coursePlans,
    cards,
    displayedPlayCards,
    placeHits,
    courseIdParam,
    fixedCourseFromSession,
    qRaw,
  ]);

  useLayoutEffect(() => {
    if (!convCtx?.sessionId || bootstrapBusy || pageBusy || isLoading) return;
    if (convCtx.clarificationNeeded) return;
    const ids = displayedPlayCards.map((card) => card.id).filter(Boolean);
    if (!ids.length) return;
    patchLastRecommendations(convCtx.sessionId, ids.slice(0, 20), qRaw, displayedPlayCards, embedded ? utterance?.id : undefined);
  }, [convCtx, bootstrapBusy, pageBusy, isLoading, displayedPlayCards, qRaw]);

  const logBase = useMemo(() => analyticsFromScenario(effectiveScenario), [effectiveScenario]);

  const isCourseMode = effectiveMode === "course";
  const isSituationResultsQuery = matchSituationResultsQuery(qRaw);
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
  const forceShowListByCards = cards.length > 0 || (directSearchMode && placeHits.length > 0);
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
  const dataNotice = resolveResultsDataNotice({
    recommendationBlocked,
    recommendationLoadFailed,
    nameSearchBlocked,
    nameSearchFailed,
    verifiedRecommendationCount: cards.length,
    verifiedPlaceHitCount: placeHits.length,
    foodRecommendationBlocked: linkedFoodLoading ? false : foodRecommendationBlocked,
    foodRecommendationLoadFailed: linkedFoodLoading ? false : foodRecommendationLoadFailed,
    baseShowEmptyState,
    forceShowListByCards,
  });
  const showEmptyState = dataNotice.showEmptyState;

  useEffect(() => {
    logDirectSearchPipeline("[SEARCH_API_RESULT_COUNT]", {
      query: qRaw,
      placeHitsCount: placeHits.length,
      directSearchMode,
    });
    logDirectSearchPipeline("[DIRECT_SEARCH_CANDIDATES]", {
      query: qRaw,
      placeHitsTop: placeHits.slice(0, 12).map((c) => c.name),
    });
    logDirectSearchPipeline("[FINAL_UI_CARDS]", {
      query: qRaw,
      primaryListCount: primaryListCards.length,
      cardsFromHome: cards.length,
    });
    console.log("[empty state conflict check]", {
      qRaw,
      cardsCount: primaryListCards.length,
      placeSearchEnabled,
      directSearchMode,
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
    let renderedMode = "other";
    if (showCourseDeck) renderedMode = "course_deck";
    else if (dataNotice.showSuppressionError) renderedMode = "suppression_error";
    else if (dataNotice.showFetchError) renderedMode = "fetch_error";
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
    showEmptyState,
    dataNotice.showSuppressionError,
    dataNotice.showFetchError,
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
    const slice = (
      embedded && rejectedMainPickIds.length
        ? primaryListCards.filter((card) => card.id && !rejectedMainPickIds.includes(card.id))
        : primaryListCards
    ).slice(0, RECOMMEND_DECK_SIZE);
    if (!slice.length) {
      recommendDeckLogged.current = true;
      return;
    }
    recommendDeckLogged.current = true;
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
      const sessionSnapshot = buildRecommendationSessionSnapshot({
        query: qRaw,
        scenario: effectiveScenario,
        cards: slice,
      });
      const nextHistory = mergeImpressionHistory(
        sessionHistoryRef.current,
        sessionSnapshot,
        now.toISOString()
      );
      sessionHistoryRef.current = nextHistory;
      setSessionHistory(nextHistory);
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
          engine_version: RECOMMENDATION_ENGINE_VERSION,
          recommendation_voices: slice.map((c) => c.recommendationVoice ?? null),
          course_fixed: isCourseFixedResults,
        },
        analytics_v2: {
          recommendation_id: recId,
          category_clicked: intentCategoryToCategoryClicked(effectiveScenario.intentCategory),
          user_profile: (mergedProfileForRanking ?? {}) as unknown as Record<string, unknown>,
          shown_place_ids: sessionSnapshot.shown_places.map((p) => p.place_id),
          main_pick_id: sessionSnapshot.shown_places[0]?.place_id ?? null,
          session_snapshot: sessionSnapshot,
          recommendation_reasons: {
            engine_version: sessionSnapshot.engine_version,
            query: sessionSnapshot.query,
            qu_snapshot: sessionSnapshot.qu_snapshot,
            items: sessionSnapshot.shown_places.map((p, i) => ({
              id: p.place_id,
              place_id: p.place_id,
              position: p.position,
              name: p.name,
              category: p.category,
              voice: slice[i]?.recommendationVoice ?? null,
              reasonText: p.reason_text,
              distance_m: p.distance_m,
              travel_time_min: p.travel_time_min,
              breakdown: (slice[i] as { recommendationScoreBreakdown?: unknown } | undefined)
                ?.recommendationScoreBreakdown ?? null,
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
    rejectedMainPickIds,
    embedded,
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

  const askInstead = convCtx?.clarificationNeeded === true;
  const shownPlaceNames = askInstead ? [] : displayedPlayCards.slice(0, 3).map((card) => card.name);
  const conversationShownPlayCount =
    !askInstead && displayedPlayCards.length > 0 && (!pageBusy || mealKeepsPlay)
      ? Math.min(3, displayedPlayCards.length)
      : 0;
  const conversationShownFoodCount =
    linkedFoodActive && !linkedFoodLoading && !foodRecommendationBlocked && !foodRecommendationLoadFailed
      ? Math.min(3, foodRestaurantCards.length)
      : 0;
  const conversationShownCardCount = conversationShownPlayCount + conversationShownFoodCount;
  const conversationTurnPending = Boolean(
    !utterance?.id ||
      !convCtx?.turns.some((turn) => turn.turnId === utterance.id) ||
      askInstead ||
      !placeLookupDone ||
      (pageBusy && !mealKeepsPlay) ||
      (linkedFoodActive && linkedFoodLoading)
  );
  const conversationTurnOutcome = resolveConversationTurnOutcome({
    pending: conversationTurnPending,
    shownCardCount: conversationShownCardCount,
    suppressionFailed: dataNotice.showSuppressionError || (!linkedFoodLoading && foodRecommendationBlocked),
    fetchFailed:
      dataNotice.showFetchError ||
      (!linkedFoodLoading && !foodRecommendationBlocked && foodRecommendationLoadFailed),
  });

  useEffect(() => {
    if (holdTranscript) return;
    if (!embedded || !utterance?.id || !conversationTurnOutcome) return;
    if (!claimConversationTurnOutcome(utterance.id)) return;
    logEvent(HamaEvents.conversation_turn_outcome, {
      turn_id: utterance.id,
      outcome: conversationTurnOutcome,
      shown_card_count: conversationShownCardCount,
      latency_ms: Math.max(0, Math.round(performance.now() - started.current)),
      screen: CONVERSATION_TURN_OUTCOME_SCREEN,
    });
  }, [embedded, holdTranscript, utterance?.id, conversationTurnOutcome, conversationShownCardCount]);
  const shownPlaceKey = shownPlaceNames.join("|");

  useEffect(() => {
    if (holdTranscript) return;
    if (preserveAssistantRef.current) return;
    if (!convCtx || pageBusy || bootstrapBusy) return;
    const intent = effectiveScenario ?? convCtx.currentIntent;
    const reply = composeAssistantReply({
      clarificationNeeded: askInstead,
      clarificationText: convCtx.regionClarification,
      intent,
      placeNames: shownPlaceNames,
      excludedPlaceCount: convCtx.rejectedPlaceIds?.length ?? 0,
      linkedFoodKeptSeparate: linkedFoodActive,
      foodPlaceNames:
        linkedFoodActive && !linkedFoodLoading && !foodRecommendationBlocked && !foodRecommendationLoadFailed
          ? foodRestaurantCards.slice(0, 3).map((card) => card.name)
          : [],
      suppressEmptyFoodResult:
        linkedFoodActive && (linkedFoodLoading || foodRecommendationBlocked || foodRecommendationLoadFailed),
      foodNearNeedsAnchor,
      foodAnchorNote: foodAnchor
        ? foodAnchorProvisional
          ? ` 식사 거리는 첫 놀이 장소인 ${foodAnchor.name} 기준 직선거리예요.`
          : ` 식사 거리는 ${foodAnchor.name} 기준 직선거리예요.`
        : foodMissingCoords
          ? " 놀이 장소 좌표가 없어 식사 직선거리를 계산하지 않았어요."
          : "",
      indoorEvidenceOnly: effectiveScenario?.indoorPreferred === true,
    });
    const next = persistAssistantReply(reply.text, qRaw);
    if (!next) return;
    setConvCtx((current) => {
      if (!current) return next;
      const last = current.turns[current.turns.length - 1];
      const saved = next.turns[next.turns.length - 1];
      if (last?.role === "assistant" && last.text === saved?.text && current.turns.length === next.turns.length) {
        return current;
      }
      return next;
    });
  }, [
    convCtx,
    pageBusy,
    bootstrapBusy,
    askInstead,
    shownPlaceKey,
    effectiveScenario,
    foodRestaurantCards,
    foodNearNeedsAnchor,
    linkedFoodActive,
    linkedFoodLoading,
    foodRecommendationBlocked,
    foodRecommendationLoadFailed,
    qRaw,
    holdTranscript,
  ]);

  useEffect(() => {
    if (!qRaw) return;
    if (pageBusy || bootstrapBusy) rankingSeenForQuery.current = qRaw;
  }, [qRaw, pageBusy, bootstrapBusy]);

  useEffect(() => {
    if (holdTranscript) return;
    if (!embedded || !convCtx?.sessionId || askInstead) return;
    if ((pageBusy && !mealKeepsPlay) || bootstrapBusy) return;
    if (!mealKeepsPlay && rankingSeenForQuery.current !== qRaw) return;
    if (linkedFoodActive && linkedFoodLoading) return;
    const play = (rejectedMainPickIds.length ? freshPlayCards : displayedPlayCards).slice(0, 3);
    const playRefreshNote =
      rejectedMainPickIds.length > 0 &&
      play.length === 0 &&
      !dataNotice.showFetchError &&
      !dataNotice.showSuppressionError &&
      !recommendationBlocked &&
      !recommendationLoadFailed
        ? "조건에 맞는 다른 장소를 찾지 못했어요."
        : null;
    if (!play.length && !playRefreshNote) return;
    const turns = convCtx.turns;
    let assistantText = "";
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const turn = turns[index];
      if (turn?.role === "user" && turn.text === qRaw) break;
      if (turn?.role === "assistant") assistantText = turn.text;
    }
    recordDialogueSnapshot(
      convCtx.sessionId,
      {
        userText: qRaw,
        turnId: utterance?.id,
        assistantText,
        playCards: play,
        foodCards: linkedFoodActive ? foodRestaurantCards.slice(0, 3) : [],
        anchorName: foodAnchor?.name ?? null,
        provisional: foodAnchorProvisional,
        playRefreshNote,
      },
      qRaw
    );
  }, [
    embedded,
    convCtx?.sessionId,
    convCtx?.turns,
    askInstead,
    pageBusy,
    mealKeepsPlay,
    bootstrapBusy,
    linkedFoodActive,
    linkedFoodLoading,
    displayedPlayCards,
    freshPlayCards,
    rejectedMainPickIds,
    dataNotice.showFetchError,
    dataNotice.showSuppressionError,
    recommendationBlocked,
    recommendationLoadFailed,
    foodRestaurantCards,
    foodAnchor,
    foodAnchorProvisional,
    qRaw,
    utterance?.id,
    holdTranscript,
  ]);

  const applyNewQuery = (next: string, src?: string) => {
    const t = next.trim();
    if (!t) return;
    recordRecentIntent(t);
    logEvent("search_submit", mergeLogPayload(parseScenarioIntent(t), { query: t, source: src ?? "results" }));
    router.push(`${embedded ? "/" : "/results"}?q=${encodeURIComponent(t)}`);
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

  const freezeRejectForPlace = (placeId: string) => {
    const frozen = freezeContextualRejectContext({
      placeId,
      recommendationId: recommendSessionId,
      sessionHistory: sessionHistoryRef.current,
    });
    if (frozen) setContextualReject(frozen);
  };

  const submitFrozenContextualReason = (reason: RecommendationRejectReason) => {
    const payload = buildFrozenContextualRejectPayload(contextualReject, reason);
    if (payload) logContextualRejectFeedback(payload);
    setContextualReject(null);
  };

  const findAgain = () => {
    if (refreshingDeck || pageBusy || isLoading || mealKeepsPlay || holdTranscript) return;
    const source = rejectedMainPickIds.length ? freshPlayCards : primaryListCards;
    const deck = source.slice(0, RECOMMEND_DECK_SIZE);
    const ids = deck.map((card) => card.id).filter(Boolean);
    if (!ids.length) return;
    frozenPlayRef.current = deck;
    awaitingRefreshBusy.current = false;
    preserveAssistantRef.current = true;
    setRefreshingDeck(true);
    setRejectedMainPickIds((prev) => mergeExcludeForDisplayedDeck(prev, ids));
    setShuffleKey((key) => key + 1);
  };

  const rejectMainAndRefresh = () => {
    const deck = primaryListCards.slice(0, RECOMMEND_DECK_SIZE);
    const id = deck[0]?.id;
    if (!id) return;
    const homeRepeat =
      Boolean(effectiveScenario) &&
      shouldApplyHomeSituationRepeatAvoidance(
        qRaw,
        effectiveScenario!,
        classifyDiscoveryQuery(qRaw, effectiveScenario!)
      );
    const deckIds = homeRepeat ? deck.map((c) => c.id).filter(Boolean) : [id];
    const recId = recommendSessionId;
    if (recId && effectiveScenario) {
      const now = new Date();
      const sessionSnapshot = buildRecommendationSessionSnapshot({
        query: qRaw,
        scenario: effectiveScenario,
        cards: primaryListCards.slice(0, RECOMMEND_DECK_SIZE),
      });
      const nextHistory = mergeImpressionHistory(
        sessionHistoryRef.current,
        sessionSnapshot,
        now.toISOString()
      );
      sessionHistoryRef.current = nextHistory;
      setSessionHistory(nextHistory);
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
    setRejectedMainPickIds((prev) => mergeExcludeForDisplayedDeck(prev, deckIds));
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

  if (embedded) {
    const visiblePlay =
      !askInstead && conversationPlayCards.length > 0 && (!pageBusy || mealKeepsPlay || refreshingDeck)
        ? conversationPlayCards.slice(0, 3)
        : [];
    const refreshEmptyNote =
      !refreshingDeck &&
      !pageBusy &&
      rejectedMainPickIds.length > 0 &&
      freshPlayCards.length === 0 &&
      !dataNotice.showFetchError &&
      !dataNotice.showSuppressionError &&
      !recommendationBlocked &&
      !recommendationLoadFailed
        ? "조건에 맞는 다른 장소를 찾지 못했어요."
        : null;
    const history = convCtx?.dialogueHistory ?? [];
    const turns = convCtx?.turns ?? [];
    const heldEntry = holdTranscript
      ? history.find((entry) => (utterance?.id ? entry.turnId === utterance.id : entry.userText === qRaw))
      : undefined;
    const userTurns = turns.filter((turn) => turn.role === "user");
    const entries = userTurns.map((userTurn) => {
      const current = Boolean(utterance?.id) && userTurn.turnId === utterance?.id;
      const saved = history.find((entry) =>
        userTurn.turnId ? entry.turnId === userTurn.turnId : !entry.turnId && entry.userText === userTurn.text
      );
      const userIndex = turns.lastIndexOf(userTurn);
      let assistantText = saved?.assistantText ?? "";
      for (let index = userIndex + 1; index < turns.length; index += 1) {
        const turn = turns[index];
        if (!turn || turn.role === "user") break;
        if (turn.role === "assistant") assistantText = turn.text;
      }
      return {
        turnId: userTurn.turnId,
        userText: userTurn.text,
        assistantText,
        playCards: current
          ? heldEntry?.playCards?.length
            ? heldEntry.playCards
            : dataNotice.showRecommendationCards && visiblePlay.length
              ? visiblePlay
              : []
          : saved?.playCards ?? [],
        foodCards: !current
          ? saved?.foodCards ?? []
          : heldEntry
            ? heldEntry.foodCards ?? []
            : linkedFoodActive &&
                !linkedFoodLoading &&
                !foodRecommendationBlocked &&
                !foodRecommendationLoadFailed
              ? foodRestaurantCards.slice(0, 3)
              : [],
        blockedMessage: current && dataNotice.showSuppressionError
          ? SUPPRESSION_UNAVAILABLE_MESSAGE
          : current && dataNotice.showFetchError
            ? RECOMMEND_DATA_UNAVAILABLE_MESSAGE
            : null,
        foodBlocked: current && !linkedFoodLoading && foodRecommendationBlocked,
        foodUnavailableMessage:
          current && !linkedFoodLoading && !foodRecommendationBlocked && foodRecommendationLoadFailed
            ? RECOMMEND_DATA_UNAVAILABLE_MESSAGE
            : null,
        playRefreshNote: current ? (heldEntry?.playRefreshNote ?? refreshEmptyNote) : saved?.playRefreshNote ?? null,
        anchorName: current ? foodAnchor?.name ?? saved?.anchorName ?? null : saved?.anchorName ?? null,
        provisional: current ? foodAnchorProvisional : Boolean(saved?.provisional),
        current,
        loading: current && !heldEntry && Boolean(pageBusy && !mealKeepsPlay) && !refreshingDeck,
        showFood: current
          ? heldEntry
            ? Boolean(heldEntry.foodCards?.length)
            : Boolean(linkedFoodActive && !askInstead)
          : Boolean(saved?.foodCards?.length),
        foodLoading: current && !heldEntry && linkedFoodLoading,
        animatePlay: current && !heldEntry && !mealKeepsPlay,
        animateFood: current && !heldEntry,
      };
    });
    if (utterance && !userTurns.some((turn) => turn.turnId === utterance.id)) {
      entries.push({
        turnId: utterance.id,
        userText: utterance.text,
        assistantText: "",
        playCards: [],
        foodCards: [],
        blockedMessage: null,
        foodBlocked: false,
        foodUnavailableMessage: null,
        playRefreshNote: null,
        anchorName: null,
        provisional: false,
        current: true,
        loading: Boolean(pageBusy && !mealKeepsPlay) && !refreshingDeck,
        showFood: false,
        foodLoading: false,
        animatePlay: false,
        animateFood: false,
      });
    }
    return (
      <HamaConversationView
        entries={entries}
        quiet={holdTranscript}
        initialScrollTop={holdTranscript ? resume?.scrollTop : undefined}
        initialOpened={holdTranscript ? resume?.opened : undefined}
        initialSelected={holdTranscript ? resume?.selected : undefined}
        transcriptRef={transcriptRef}
        playChoices={visiblePlay.filter((card) => typeof card.lat === "number" && typeof card.lng === "number")}
        onPickAnchor={setFoodAnchorId}
        onReject={(placeId) => {
          freezeRejectForPlace(placeId);
          rejectMainAndRefresh();
        }}
        onRefresh={!mealKeepsPlay && !holdTranscript ? findAgain : undefined}
        refreshing={refreshingDeck}
      />
    );
  }

  return (
    <main
      style={{
        minHeight: embedded ? 0 : "100vh",
        paddingBottom: embedded ? 16 : 100,
        background: embedded ? "transparent" : `linear-gradient(180deg, ${colors.bgDefault} 0%, ${colors.bgMuted} 100%)`,
      }}
    >
      <div style={{ maxWidth: RESULTS_CONTENT_MAX_WIDTH, width: "100%", margin: "0 auto", padding: embedded ? "8px 0 0" : `16px ${space.pageX}px 0`, boxSizing: "border-box" }}>
        {embedded ? null : (
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
        )}
        <ResultsHeader isLoading={headerLoading} queryLabel={qRaw || effectiveScenario?.rawQuery} />
        <ResultsConversation
          turns={convCtx?.turns ?? []}
          value={retryInput}
          onChange={setRetryInput}
          disabled={pageBusy}
          hideComposer={embedded}
          onSubmit={(text) => {
            applyNewQuery(text, "conversation");
            setRetryInput("");
          }}
        />
        <ActiveConstraintChips chips={constraintChips} excludeLabels={[qRaw || effectiveScenario?.rawQuery || ""]} />

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

        {!askInstead && !bootstrapBusy && placeLookupDone && showNameSearch && dataNotice.showPlaceHits && (
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

        {!askInstead &&
          !bootstrapBusy &&
          showNameSearch &&
          dataNotice.showRecommendationCards &&
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
          !nameSearchFailed &&
          !nameSearchBlocked &&
          !showNameSearch &&
          !pageBusy &&
          !showCourseDeck &&
          dataNotice.showRecommendationCards &&
          primaryListCards.length > 0 && (
            <p style={{ fontSize: 13, color: colors.textSecondary, margin: "0 0 12px", lineHeight: 1.45 }}>
              같은 이름의 매장은 못 찾았어. 대신 이런 곳은 어때?
            </p>
          )}

        {dataNotice.showSuppressionError && !askInstead && !pageBusy ? (
          <p data-hama-suppression-error="" style={{ color: colors.textPrimary, lineHeight: 1.5, margin: "0 0 16px" }}>
            {SUPPRESSION_UNAVAILABLE_MESSAGE}
          </p>
        ) : null}

        {dataNotice.showFetchError && !askInstead && !pageBusy ? (
          <p data-hama-recommend-error="" style={{ color: colors.textPrimary, lineHeight: 1.5, margin: "0 0 16px" }}>
            {RECOMMEND_DATA_UNAVAILABLE_MESSAGE}
          </p>
        ) : null}

        {showEmptyState && !askInstead && (
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

        {!askInstead &&
          dataNotice.showRecommendationCards &&
          !showNameSearch &&
          displayedPlayCards.length > 0 &&
          (!pageBusy || mealKeepsPlay) && (
          <div data-hama-play-list="">
            {matchedNamedFoodPreset?.id === "chinese" && (
              <p style={{ fontSize: 14, color: colors.textPrimary, margin: "0 0 10px", lineHeight: 1.5 }}>
                중식으로 보기 좋은 곳을 골랐어요
              </p>
            )}
            <OpenExplorationMapButton cards={displayedPlayCards} />
            <RecommendationList
              cards={displayedPlayCards}
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
              recommendationId={recommendSessionId}
              sessionHistory={sessionHistory}
              onRejectRecommendation={(placeId) => {
                freezeRejectForPlace(placeId);
                rejectMainAndRefresh();
              }}
              onOpenContextualReject={freezeRejectForPlace}
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
          </div>
        )}

        {linkedFoodActive && !askInstead && (linkedFoodLoading || (!foodRecommendationBlocked && !foodRecommendationLoadFailed)) ? (
          <LinkedFoodGroup
            cards={
              linkedFoodLoading || foodRecommendationBlocked || foodRecommendationLoadFailed
                ? []
                : foodRestaurantCards.slice(0, 5)
            }
            loading={linkedFoodLoading}
            anchorName={foodAnchor?.name ?? null}
            provisional={foodAnchorProvisional}
            needsCoords={foodMissingCoords}
            playChoices={displayedPlayCards.filter(
              (card) => typeof card.lat === "number" && typeof card.lng === "number"
            )}
            onPickAnchor={setFoodAnchorId}
            onOpen={(card) => {
              stashPlaceForSession(card);
              router.push(`/place/${encodeURIComponent(card.id)}`);
            }}
            onDirections={(card) => {
              const lat = typeof card.lat === "number" ? card.lat : null;
              const lng = typeof card.lng === "number" ? card.lng : null;
              openDirections({ name: card.name, lat, lng });
            }}
          />
        ) : null}

        {contextualReject ? (
          <ContextualRejectReasonBar
            onSelect={submitFrozenContextualReason}
            onSkip={() => setContextualReject(null)}
          />
        ) : null}

        {!askInstead && !pageBusy && showCourseDeck && (
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

export function EmbeddedResults({
  utterance,
  resume = null,
}: {
  utterance: { id: string; text: string } | null;
  resume?: HomeResume | null;
}) {
  return (
    <Suspense fallback={null}>
      <ResultsContent embedded utterance={utterance} resume={resume} />
    </Suspense>
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
