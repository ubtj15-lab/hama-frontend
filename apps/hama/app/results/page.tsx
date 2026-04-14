"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { applyRecommendationModeToScenario } from "@/lib/scenarioEngine/effectiveScenario";
import type { RecommendationMode } from "@/lib/scenarioEngine/types";
import type { IntentionType } from "@/lib/intention";
import type { HomeCard } from "@/lib/storeTypes";
import { RECOMMEND_DECK_SIZE, RECENT_EXCLUDE_LIMIT } from "@/lib/recommend/recommendConstants";
import { ResultsHeader } from "@/_components/results/ResultsHeader";
import { ActiveConstraintChips } from "@/_components/results/ActiveConstraintChips";
import { RecommendationList } from "@/_components/results/RecommendationList";
import { SearchResultSection } from "@/_components/results/SearchResultSection";
import { CourseDeckCard } from "@/_components/results/CourseDeckCard";
import { RecommendationModeToggle } from "@/_components/results/RecommendationModeToggle";
import { NextSuggestions } from "@/_components/results/NextSuggestions";
import { colors, space } from "@/lib/designTokens";
import { logEvent } from "@/lib/logEvent";
import { HamaEvents } from "@/lib/analytics/events";
import { analyticsFromScenario, mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import { openDirections } from "@/lib/openDirections";
import { stashPlaceForSession } from "@/lib/session/placeSession";
import { stashCoursePlan } from "@/lib/session/courseSession";
import { recordRecentIntent } from "@/lib/recentIntents";
import FeedbackFab from "@/components/FeedbackFab";

/** 결과 페이지만: 고정 더미로 SearchResultSection/분기 검증 — `.env.local` 에 `NEXT_PUBLIC_DEBUG_FORCE_SEARCH_SECTION=1` */
const DEBUG_FORCE_SEARCH_SECTION = process.env.NEXT_PUBLIC_DEBUG_FORCE_SEARCH_SECTION === "1";

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qRaw = searchParams.get("q")?.trim() ?? "";
  const [shuffleKey, setShuffleKey] = useState(0);
  const started = useRef<number>(0);
  const [modeOverride, setModeOverride] = useState<RecommendationMode | null>(null);

  const [convCtx, setConvCtx] = useState<ConversationContext | null>(null);

  useEffect(() => {
    setModeOverride(null);
  }, [qRaw]);

  useEffect(() => {
    if (!qRaw) {
      setConvCtx(null);
      return;
    }
    const prev = loadConversationContext();
    setConvCtx(processConversationTurn(qRaw, prev));
  }, [qRaw]);

  useEffect(() => {
    started.current = performance.now();
    setShuffleKey((k) => k + 1);
  }, [qRaw]);

  useEffect(() => {
    if (!qRaw) router.replace("/");
  }, [qRaw, router]);

  const scenarioObject = useMemo(() => mergeResultsScenario(qRaw, convCtx), [qRaw, convCtx]);

  const effectiveMode: RecommendationMode = useMemo(() => {
    const inferred = scenarioObject?.recommendationMode ?? "single";
    return modeOverride ?? inferred;
  }, [scenarioObject?.recommendationMode, modeOverride]);

  const effectiveScenario = useMemo(() => {
    if (!scenarioObject) return null;
    return applyRecommendationModeToScenario(scenarioObject, effectiveMode);
  }, [scenarioObject, effectiveMode]);

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

  const { cards, candidatePool, courseCandidatePool, isLoading } = useHomeCards(
    "all",
    shuffleKey,
    intent,
    {
      userLat: userLoc?.lat ?? null,
      userLng: userLoc?.lng ?? null,
      excludeStoreIds: recentExcludeIds,
      searchQuery: (convCtx?.cumulativeText ?? qRaw) || null,
      scenarioObject: effectiveScenario ?? undefined,
      /** 매장명 검색이 끝날 때까지 추천 페치·랭킹 지연 — 첫 프레임 레이스 방지 */
      deferRanking: !rankingBootstrapReady || deferRecForPlaceLookup,
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

  const coursePlans = useMemo(() => {
    if (!effectiveScenario || effectiveScenario.recommendationMode !== "course") return [];
    const pool = courseCandidatePool.length ? courseCandidatePool : candidatePool;
    if (!pool.length) return [];
    const cfg = resolveScenarioConfig(effectiveScenario);
    return generateCourses(pool, effectiveScenario, cfg, 3, { homeTab: "all" });
  }, [effectiveScenario, candidatePool, courseCandidatePool]);

  useEffect(() => {
    if (!convCtx?.sessionId || bootstrapBusy) return;
    if (placeLookupBusy) return;

    const hitIds = placeHits.slice(0, RECOMMEND_DECK_SIZE).map((c) => c.id);

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
  ]);

  const logBase = useMemo(() => analyticsFromScenario(effectiveScenario), [effectiveScenario]);

  const isCourseMode = effectiveMode === "course";
  const showCourseDeck = Boolean(!pageBusy && isCourseMode && coursePlans.length > 0 && !showNameSearch);
  const courseFallbackActive = Boolean(!pageBusy && isCourseMode && coursePlans.length === 0);
  const showRecommendationList = Boolean(!pageBusy && (!isCourseMode || courseFallbackActive));

  useEffect(() => {
    if (pageBusy || effectiveMode !== "course" || isLoading) return;
    if (coursePlans.length > 0) return;
    setModeOverride("single");
    setShuffleKey((k) => k + 1);
  }, [pageBusy, effectiveMode, isLoading, coursePlans.length]);

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
    if (!showRecommendationList || cards.length === 0) return;
    if (recommendDeckLogged.current) return;
    recommendDeckLogged.current = true;
    const slice = cards.slice(0, RECOMMEND_DECK_SIZE);
    logEvent(
      HamaEvents.recommend_deck_impression,
      mergeLogPayload(logBase, {
        query: qRaw,
        place_ids: slice.map((c) => c.id),
        recommendation_voices: slice.map((c) => c.recommendationVoice ?? null),
        count: slice.length,
        page: "results",
      })
    );
  }, [qRaw, pageBusy, showNameSearch, showRecommendationList, cards, logBase]);

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
    cards.length > 0 &&
    cards.length < RECOMMEND_DECK_SIZE;

  const headerLoading = bootstrapBusy || (placeLookupBusy && !showNameSearch);

  const headerCount =
    !pageBusy && isCourseMode && coursePlans.length > 0
      ? coursePlans.length
      : !pageBusy && showNameSearch
        ? Math.min(placeHits.length, RECOMMEND_DECK_SIZE)
        : !pageBusy
          ? cards.length
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
          background: `linear-gradient(180deg, ${colors.bgDefault} 0%, #EEF2FF 100%)`,
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

  if (!qRaw) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        paddingBottom: 100,
        background: `linear-gradient(180deg, ${colors.bgDefault} 0%, #EEF2FF 100%)`,
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
        {!bootstrapBusy && !showNameSearch && (
          <RecommendationModeToggle
            mode={effectiveMode}
            onSelectCourse={() => {
              setModeOverride("course");
              setShuffleKey((k) => k + 1);
            }}
            onSelectSingle={() => {
              setModeOverride("single");
              setShuffleKey((k) => k + 1);
            }}
          />
        )}
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
          cards.length > 0 && (
            <p style={{ fontSize: 13, color: colors.textSecondary, margin: "0 0 12px", lineHeight: 1.45 }}>
              같은 이름의 매장은 못 찾았어. 대신 이런 곳은 어때?
            </p>
          )}

        {!bootstrapBusy &&
          !showNameSearch &&
          !pageBusy &&
          !showCourseDeck &&
          cards.length === 0 &&
          placeLookupDone && (
            <p style={{ color: colors.textSecondary }}>
              {placeSearchEnabled
                ? "이름으로는 찾지 못했어. 다른 말로 한 번만 더 말해줄래?"
                : "지금은 보여줄 카드가 없어. 다른 말로 한 번만 더 말해줄래?"}
            </p>
          )}

        {courseFallbackActive && !showNameSearch && cards.length > 0 && (
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

        {!pageBusy && !showNameSearch && showRecommendationList && cards.length > 0 && (
          <RecommendationList
            cards={cards}
            scenarioObject={effectiveScenario}
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

        {!pageBusy && showCourseDeck && (
          <div style={{ display: "flex", flexDirection: "column", gap: space.card }}>
            {coursePlans.slice(0, 3).map((plan, i) => {
              const first = plan.stops[0];
              const thumbCard = first ? poolById.get(first.placeId) ?? null : null;
              return (
                <CourseDeckCard
                  key={plan.id}
                  plan={plan}
                  rank={i}
                  thumbCard={thumbCard}
                  badges={plan.badges}
                  onOpenCourse={() => {
                    stashCoursePlan(plan);
                    logEvent("home_course_pick", mergeLogPayload(logBase, { course_id: plan.id }));
                    router.push(`/course?id=${encodeURIComponent(plan.id)}`);
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
