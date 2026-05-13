import type { HomeCard } from "@/lib/storeTypes";
import type { HomeTabKey } from "@/lib/storeTypes";
import {
  fetchHomeCardsByTab,
  fetchHomeCardsByStoreCategories,
  fetchHomeRecommendCandidates,
} from "@/lib/storeRepository";
import { RECOMMEND_POOL_SINGLE_TAB } from "@/lib/recommend/recommendConstants";
import type { RecommendVertical } from "./normalizeRequest";

export type FetchCandidatesV2Result = {
  cards: HomeCard[];
  /** 단일 탭 또는 복합 설명 */
  fetchTab: string;
  /** storeRepository 출처 요약 */
  source: string;
};

function mergeDedupe(a: HomeCard[], b: HomeCard[]): HomeCard[] {
  const m = new Map<string, HomeCard>();
  for (const c of [...a, ...b]) {
    if (c?.id && !m.has(c.id)) m.set(c.id, c);
  }
  return [...m.values()];
}

function dedupeByIdMany(cards: HomeCard[]): HomeCard[] {
  const m = new Map<string, HomeCard>();
  for (const c of cards) {
    const id = String(c?.id ?? "");
    if (id && !m.has(id)) m.set(id, c);
  }
  return [...m.values()];
}

/**
 * v2: vertical별 전용 소스만 조회. `fetchHomeRecommendCandidates("all")`는 vertical===all 일 때만.
 */
export async function fetchCandidatesV2(
  vertical: RecommendVertical,
  count: number = RECOMMEND_POOL_SINGLE_TAB
): Promise<FetchCandidatesV2Result> {
  if (vertical === "all") {
    const cards = await fetchHomeRecommendCandidates("all");
    return {
      cards,
      fetchTab: "all",
      source: "fetchHomeRecommendCandidates(all)",
    };
  }

  if (vertical === "beauty") {
    const target = Math.max(240, count);
    const chunk = Math.max(90, Math.ceil(target / 3));
    const [salonRows, beautyRows, bk9Rows] = await Promise.all([
      fetchHomeCardsByTab("salon", { count: chunk, useBeautySalonCategoryCodes: false }),
      fetchHomeCardsByStoreCategories(["beauty"], { count: chunk }),
      fetchHomeCardsByStoreCategories(["bk9"], { count: chunk }),
    ]);
    const cards = dedupeByIdMany([...salonRows, ...beautyRows, ...bk9Rows]);
    return {
      cards,
      fetchTab: "salon+beauty+bk9",
      source: "parallel salon tab + beauty + bk9, deduped by id",
    };
  }

  if (vertical === "fitness") {
    const cards = await fetchHomeCardsByStoreCategories(["fitness", "gym", "sports", "activity"], {
      count,
    });
    return {
      cards,
      fetchTab: "fitness+gym+sports+activity",
      source: "fetchHomeCardsByStoreCategories",
    };
  }

  if (vertical === "life") {
    const cards = await fetchHomeCardsByTab("life" as HomeTabKey, { count });
    return { cards, fetchTab: "life", source: "fetchHomeCardsByTab(life)" };
  }

  if (vertical === "cafe") {
    const cards = await fetchHomeCardsByStoreCategories(["cafe", "ce7"], { count });
    return { cards, fetchTab: "cafe+ce7", source: "fetchHomeCardsByStoreCategories" };
  }

  if (vertical === "restaurant") {
    const cards = await fetchHomeCardsByStoreCategories(["restaurant", "fd6"], { count });
    return { cards, fetchTab: "restaurant+fd6", source: "fetchHomeCardsByStoreCategories" };
  }

  if (vertical === "activity") {
    const [museumRows, activityRows] = await Promise.all([
      fetchHomeCardsByTab("museum", { count: Math.ceil(count / 2) }),
      fetchHomeCardsByTab("activity", { count: Math.ceil(count / 2) }),
    ]);
    const cards = mergeDedupe(museumRows, activityRows);
    return {
      cards,
      fetchTab: "museum+activity",
      source: "fetchHomeCardsByTab(museum)+fetchHomeCardsByTab(activity)",
    };
  }

  return { cards: [], fetchTab: "none", source: "none" };
}
