"use client";

import { useEffect, useState } from "react";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import {
  fetchHomeCardsByTab,
  fetchHomeCourseCandidatePool,
  fetchHomeRecommendCandidates,
  toHomeCard,
  type StoreRow,
} from "@/lib/storeRepository";
import type { IntentionType } from "@/lib/intention";
import { buildTopRecommendations } from "@/lib/recommend/scoring";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { intentCategoryToHomeTab } from "@/lib/scenarioEngine/intentClassification";
import { RECOMMEND_DECK_SIZE, RECOMMEND_POOL_SINGLE_TAB } from "@/lib/recommend/recommendConstants";

async function fetchRecommendPoolFallback(tab: HomeTabKey, count: number): Promise<HomeCard[]> {
  try {
    const res = await fetch(
      `/api/home-recommend?tab=${encodeURIComponent(tab)}&count=${encodeURIComponent(String(count))}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: StoreRow[] };
    const items = json.items ?? [];
    return items.map((row) => toHomeCard(row));
  } catch (e) {
    console.warn("[useHomeCards] home-recommend fallback failed", e);
    return [];
  }
}

type Result = {
  cards: HomeCard[];
  /** 코스 생성 등 — 랭킹 전 후보 풀 */
  candidatePool: HomeCard[];
  /** intentType course_generation 시 — 탭과 무관한 역할별 혼합 풀(식사/카페/액티비티) */
  courseCandidatePool: HomeCard[];
  isLoading: boolean;
  /** RECOMMEND_DECK_SIZE 미만이면 완화 랭킹·후보 부족 등 */
  deckIncomplete: boolean;
};

export type UseHomeCardsOptions = {
  userLat?: number | null;
  userLng?: number | null;
  /** 홈 검색창 입력 — 키워드 점수 보조용(가중치 낮음) */
  searchQuery?: string | null;
  /** parseScenarioIntent 결과 — 랭킹·배지·코스 공통 */
  scenarioObject?: ScenarioObject | null;
  /** TODO: 최근 본 전체 제외는 RECENT_EXCLUDE_LIMIT 으로만 사용 (확장 시 서버 동기화) */
  excludeStoreIds?: string[];
  /**
   * true 이면 페치/랭킹을 하지 않고 로비만 유지.
   * 위치·최근 목록 확정 전에 한 번만 랭킹하도록 할 때 사용(중간에 카드 갈아끼움 방지).
   */
  deferRanking?: boolean;
  /**
   * true 이면 추천·코스 후보 페치를 아예 하지 않음.
   * Results: 매장명 검색이 이미 성공한 경우 뒤쪽 추천 로직이 화면/상태를 덮어쓰지 않게 할 때 사용.
   */
  skipFetch?: boolean;
  /** 메인 추천 거절 등 — 해당 매장 id 는 재랭킹에서 제외 */
  rejectedMainPickIds?: string[];
};

/**
 * 홈 추천 카드 — 후보 풀 fetch 후 클라이언트에서 결정론적 점수화
 * TODO(Supabase user_actions): 클릭/체류 데이터로 재랭킹 파이프라인 연결
 */
export function useHomeCards(
  tab: HomeTabKey,
  shuffleKey: number,
  intent: IntentionType,
  options: UseHomeCardsOptions = {}
): Result {
  const [cards, setCards] = useState<HomeCard[]>([]);
  const [pool, setPool] = useState<HomeCard[]>([]);
  const [coursePool, setCoursePool] = useState<HomeCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deckIncomplete, setDeckIncomplete] = useState(false);
  const excludeMerged = [
    ...new Set(
      [
        ...(options.excludeStoreIds ?? []),
        ...(options.rejectedMainPickIds ?? []),
        ...(options.scenarioObject?.conversationExcludePlaceIds ?? []),
      ].filter(Boolean)
    ),
  ];
  const excludeKey = excludeMerged.join("|");
  const scenarioKey = options.scenarioObject
    ? `${options.scenarioObject.scenario}:${options.scenarioObject.intentType}:${options.scenarioObject.recommendationMode ?? ""}:${options.scenarioObject.intentCategory ?? ""}:${options.scenarioObject.foodSubCategory ?? ""}:${(options.scenarioObject.menuIntent ?? []).join(",")}:${(options.scenarioObject.foodPreference ?? []).join("|")}:${(options.scenarioObject.vibePreference ?? []).join("|")}:${(options.scenarioObject.hardConstraints ?? []).join("|")}:${options.scenarioObject.timeOfDay ?? ""}:${options.scenarioObject.distanceTolerance ?? ""}:${options.scenarioObject.parkingPreferred ? "p" : ""}:${(options.scenarioObject.conversationRejectedFoodSubs ?? []).join("|")}:${(options.scenarioObject.conversationExcludeMenuTerms ?? []).join("|")}:${options.scenarioObject.confidence ?? ""}`
    : "";

  const deferRanking = options.deferRanking === true;
  const skipFetch = options.skipFetch === true;

  useEffect(() => {
    if (skipFetch) {
      setCards([]);
      setPool([]);
      setCoursePool([]);
      setIsLoading(false);
      setDeckIncomplete(false);
      return;
    }

    if (deferRanking) {
      setIsLoading(true);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      try {
        const scenarioObj = options.scenarioObject;
        const wantCourse =
          (scenarioObj?.recommendationMode ?? (scenarioObj?.intentType === "course_generation" ? "course" : "single")) ===
          "course";
        const strict =
          scenarioObj?.intentType === "search_strict" && scenarioObj.intentCategory != null;

        const [fetchedRaw, courseFetched] = await Promise.all([
          strict && scenarioObj?.intentCategory
            ? fetchHomeCardsByTab(intentCategoryToHomeTab(scenarioObj.intentCategory), {
                count: RECOMMEND_POOL_SINGLE_TAB,
              })
            : fetchHomeRecommendCandidates(tab),
          wantCourse ? fetchHomeCourseCandidatePool() : Promise.resolve<HomeCard[]>([]),
        ]);
        if (cancelled) return;

        let fetched = fetchedRaw;
        if (!fetched.length) {
          const apiTab: HomeTabKey =
            strict && scenarioObj?.intentCategory
              ? intentCategoryToHomeTab(scenarioObj.intentCategory)
              : tab;
          fetched = await fetchRecommendPoolFallback(apiTab, RECOMMEND_POOL_SINGLE_TAB);
        }
        if (!fetched.length && strict && scenarioObj?.intentCategory) {
          fetched = await fetchRecommendPoolFallback("all", 48);
        }

        const ctx = {
          intent,
          userLat: options.userLat,
          userLng: options.userLng,
          excludeStoreIds: excludeMerged,
          searchQuery: options.searchQuery,
          scenarioObject: options.scenarioObject ?? null,
        };
        let picked = buildTopRecommendations(fetched, ctx);

        if (!wantCourse && picked.length < RECOMMEND_DECK_SIZE) {
          const have = new Set(picked.map((p) => p.card.id));
          const more = buildTopRecommendations(fetched, {
            ...ctx,
            excludeStoreIds: [],
          });
          for (const p of more) {
            if (picked.length >= RECOMMEND_DECK_SIZE) break;
            if (!have.has(p.card.id)) {
              picked.push(p);
              have.add(p.card.id);
            }
          }
        }

        if (!cancelled) {
          setPool(fetched);
          setCoursePool(wantCourse ? courseFetched : []);
          setCards(picked.map((p) => p.card));
          setDeckIncomplete(!wantCourse && picked.length > 0 && picked.length < RECOMMEND_DECK_SIZE);
        }
      } catch (e) {
        console.error("[useHomeCards]", e);
        if (!cancelled) {
          setCards([]);
          setCoursePool([]);
          setDeckIncomplete(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    tab,
    shuffleKey,
    intent,
    options.userLat,
    options.userLng,
    options.searchQuery,
    excludeKey,
    scenarioKey,
    deferRanking,
    skipFetch,
  ]);

  return { cards, candidatePool: pool, courseCandidatePool: coursePool, isLoading, deckIncomplete };
}
