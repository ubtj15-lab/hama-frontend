"use client";

import { useEffect, useState } from "react";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { fetchHomeRecommendCandidates } from "@/lib/storeRepository";
import type { IntentionType } from "@/lib/intention";
import { buildTopRecommendations } from "@/lib/recommend/scoring";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";

type Result = {
  cards: HomeCard[];
  /** 코스 생성 등 — 랭킹 전 후보 풀 */
  candidatePool: HomeCard[];
  isLoading: boolean;
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
  const [isLoading, setIsLoading] = useState(false);
  const excludeKey = (options.excludeStoreIds ?? []).join("|");
  const scenarioKey = options.scenarioObject
    ? `${options.scenarioObject.scenario}:${options.scenarioObject.intentType}:${options.scenarioObject.confidence}`
    : "";

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      try {
        const fetched = await fetchHomeRecommendCandidates(tab);
        if (cancelled) return;

        const picked = buildTopRecommendations(fetched, {
          intent,
          userLat: options.userLat,
          userLng: options.userLng,
          excludeStoreIds: options.excludeStoreIds,
          searchQuery: options.searchQuery,
          scenarioObject: options.scenarioObject ?? null,
        });

        if (!cancelled) {
          setPool(fetched);
          setCards(picked.map((p) => p.card));
        }
      } catch (e) {
        console.error("[useHomeCards]", e);
        if (!cancelled) setCards([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [tab, shuffleKey, intent, options.userLat, options.userLng, options.searchQuery, excludeKey, scenarioKey]);

  return { cards, candidatePool: pool, isLoading };
}
