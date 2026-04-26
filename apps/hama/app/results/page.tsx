"use client";

import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useHomeCards } from "@/_hooks/useHomeCards";
import { useHomeMode } from "@/_hooks/useHomeMode";
import { useRecent } from "@/_hooks/useRecent";
import { usePlaceNameSearchResults } from "@/_hooks/usePlaceNameSearchResults";
import { explainPlaceNameSearchGate } from "@/lib/results/placeNameSearchIntent";
import {
  parseScenarioIntent,
  explainCourseGenerationMatch,
} from "@/lib/scenarioEngine/parseScenarioIntent";
import {
  loadConversationContext,
  processConversationTurn,
  mergeResultsScenario,
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

/** 결과 페이지만: 고정 더미로 SearchResultSection/분기 검증 — `.env.local` 에 `NEXT_PUBLIC_DEBUG_FORCE_SEARCH_SECTION=1` */
const DEBUG_FORCE_SEARCH_SECTION = process.env.NEXT_PUBLIC_DEBUG_FORCE_SEARCH_SECTION === "1";
const LOGIN_FLAG_KEY = "hamaLoggedIn";

function intentCategoryToCategoryClicked(intentCategory: string | null | undefined): string | null {
  if (!intentCategory) return null;
  if (intentCategory === "FOOD") return "푸드";
  if (intentCategory === "CAFE") return "카페";
  if (intentCategory === "BEAUTY") return "미용실";
  if (intentCategory === "ACTIVITY") return "액티비티";
  return intentCategory;
}

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseIdFromSearch = searchParams.get("courseId")?.trim() ?? "";
  const courseSnapFromSearch = searchParams.get("courseSnap")?.trim() ?? "";
  const qRaw = searchParams.get("q")?.trim() ?? "";
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

  useEffect(() => {
    try {
      const loggedIn = window.localStorage.getItem(LOGIN_FLAG_KEY) === "1";
      if (!loggedIn) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/api/auth/kakao/login?return_to=${encodeURIComponent(returnTo)}`;
      }
    } catch {}
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
    const base = mergeResultsScenario(queryForScenario, convCtx);
    if (!base || !scenarioPatch) return base;
    return { ...base, ...scenarioPatch };
  }, [queryForScenario, convCtx, scenarioPatch]);

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

  const placeNameGate = useMemo(() => explainPlaceNameSearchGate(qRaw), [qRaw]);
  const placeSearchEnabled = placeNameGate.enabled;
  const { items: placeHits, loading: placeSearchLoading, meta: placeSearchMeta } = usePlaceNameSearchResults(
    qRaw,
    placeSearchEnabled,
    userLoc?.lat,
    userLoc?.lng
  );

  const deferRecForPlaceLookup = placeSearchEnabled && placeSearchLoading;
  const placeLookupDoneEarly = !placeSearchEnabled || !placeSearchLoading;
  /** 매장명 API 성공(1건 이상)이면 추천/코스 후보 페치를 하지 않음 → 리스트가 뒤에서 덮어쓰이지 않음 */
  const placeSearchDominant = placeSearchEnabled && placeLookupDoneEarly && placeHits.length > 0;
  const resultsFlowMode = placeSearchDominant ? "place_search" : "recommendation";

  const { cards, candidatePool, courseCandidatePool, isLoading, deckIncomplete } = useHomeCards(
    "all",
    shuffleKey,
    intent,
    {
      userLat: userLoc?.lat ?? null,
      userLng: userLoc?.lng ?? null,
      excludeStoreIds: recentExcludeIds,
      rejectedMainPickIds,
      profileOverride,
      relaxPersonalRules,
      searchQuery: (convCtx?.cumulativeText ?? qRaw) || null,
      scenarioObject: effectiveScenario ?? undefined,
      /** 매장명 검색이 끝날 때까지 추천 페치·랭킹 지연 — 첫 프레임 레이스 방지 */
      deferRanking: !rankingBootstrapReady || deferRecForPlaceLookup,
      /** 세션에 고정된 코스로 돌아온 경우 재랭킹·재페치 없음 */
      skipFetch: Boolean(courseIdParam),
      /**
       * 매장명 매칭 후에도 추천 풀은 가져온다. 메인 리스트는 `!showNameSearch`일 때만 그려서
       * 검색 카드가 덮어쓰이지 않고, `secondaryRecommendCards`로 "이런 곳도 있어"만 채운다.
       */
    }
  );

  const bootstrapBusy = !rankingBootstrapReady;
  const pageBusy = !rankingBootstrapReady || isLoading;
  const placeLookupBusy = placeSearchEnabled && placeSearchLoading;
  const placeLookupDone = !placeSearchEnabled || !placeSearchLoading;
  const showNameSearch = placeSearchEnabled && placeLookupDone && placeHits.length > 0;

  const placeHitIds = useMemo(() => new Set(placeHits.map((c) => c.id)), [placeHits]);
  const secondaryRecommendCards = useMemo(
    () => cards.filter((c) => !placeHitIds.has(c.id)),
    [cards, placeHitIds]
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
  const primaryRecommendationCards: HomeCard[] = courseRestoreFailed
    ? []
    : isCourseFixedResults && courseFixedCards
      ? courseFixedCards
      : cards;

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
  const showCourseDeck = Boolean(
    !pageBusy && isCourseMode && coursePlans.length > 0 && !showNameSearch && !courseIdParam
  );
  const courseFallbackActive = Boolean(
    !pageBusy && isCourseMode && coursePlans.length === 0 && !courseIdParam
  );
  const showRecommendationList = Boolean(
    !pageBusy &&
      !courseRestoreFailed &&
      (!isCourseMode || courseFallbackActive || isCourseFixedResults)
  );

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
    if (!showRecommendationList || primaryRecommendationCards.length === 0) return;
    if (recommendDeckLogged.current) return;
    recommendDeckLogged.current = true;
    const slice = primaryRecommendationCards.slice(0, RECOMMEND_DECK_SIZE);
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
    primaryRecommendationCards,
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
    primaryRecommendationCards.length > 0 &&
    primaryRecommendationCards.length < RECOMMEND_DECK_SIZE;

  const showSoftFallbackCopy = Boolean(
    strictHint || deckIncomplete || rejectedMainPickIds.length > 0
  );
  const strictBeautyEmpty =
    effectiveScenario?.intentType === "search_strict" &&
    effectiveScenario?.intentCategory === "BEAUTY";

  const rejectMainAndRefresh = () => {
    const id = primaryRecommendationCards[0]?.id;
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

  const headerCount =
    !pageBusy && isCourseMode && coursePlans.length > 0
      ? coursePlans.length
      : !pageBusy && isCourseFixedResults
        ? primaryRecommendationCards.length
        : !pageBusy && showNameSearch
          ? Math.min(placeHits.length, RECOMMEND_DECK_SIZE)
          : !pageBusy
            ? primaryRecommendationCards.length
            : undefined;

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
        <ResultsHeader isLoading={headerLoading} resultCount={headerCount} />
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
          secondaryRecommendCards.length > 0 && (
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
              <RecommendationList
                cards={secondaryRecommendCards}
                scenarioObject={effectiveScenario}
                analyticsV2Click={analyticsV2Base ?? undefined}
                showSoftFallbackCopy={false}
                onPlaceClick={(card, rank) => {
                  logEvent(
                    "place_click",
                    mergeLogPayload(logBase, { place_id: card.id, name: card.name, card_rank: rank, source: "secondary_recommend" })
                  );
                  stashPlaceForSession(card);
                  recordView(card.id);
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
          primaryRecommendationCards.length > 0 && (
            <p style={{ fontSize: 13, color: colors.textSecondary, margin: "0 0 12px", lineHeight: 1.45 }}>
              같은 이름의 매장은 못 찾았어. 대신 이런 곳은 어때?
            </p>
          )}

        {!bootstrapBusy &&
          !showNameSearch &&
          !pageBusy &&
          !showCourseDeck &&
          primaryRecommendationCards.length === 0 &&
          placeLookupDone && (
            <p style={{ color: colors.textSecondary }}>
              {strictBeautyEmpty
                ? "이 지역에 매장이 적어요"
                : placeSearchEnabled
                ? "이름으로는 찾지 못했어. 다른 말로 한 번만 더 말해줄래?"
                : "지금은 보여줄 카드가 없어. 다른 말로 한 번만 더 말해줄래?"}
            </p>
          )}

        {courseFallbackActive && !showNameSearch && primaryRecommendationCards.length > 0 && (
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

        {!pageBusy && !showNameSearch && showRecommendationList && primaryRecommendationCards.length > 0 && (
          <RecommendationList
            cards={primaryRecommendationCards}
            scenarioObject={effectiveScenario}
            analyticsV2Click={analyticsV2Base ?? undefined}
            showSoftFallbackCopy={showSoftFallbackCopy}
            onPlaceClick={(card, rank) => {
              logEvent("place_click", mergeLogPayload(logBase, { place_id: card.id, name: card.name, card_rank: rank }));
              stashPlaceForSession(card);
              recordView(card.id);
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
        )}

        {!pageBusy &&
          !showNameSearch &&
          showRecommendationList &&
          primaryRecommendationCards.length > 0 &&
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
