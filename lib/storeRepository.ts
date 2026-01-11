// /lib/storeRepository.ts
import type { StoreRecord, HomeCard } from "./storeTypes";
import { mapStoreToHomeCard } from "./storeMappers";
import { supabase } from "./supabaseClient";

export type HomeTabKey = "all" | "restaurant" | "cafe" | "beauty" | "activity";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 탭별 category 후보(영문/한글 혹시 섞여있을 때까지 대비)
const TAB_CATEGORY_CANDIDATES: Record<Exclude<HomeTabKey, "all">, string[]> = {
  cafe: ["cafe", "카페", "coffee", "카페테리아"],
  restaurant: ["restaurant", "식당", "음식점", "FD6"],
  beauty: ["beauty", "hair", "salon", "미용실", "헤어샵", "BK9"],
  activity: ["activity", "액티비티", "AT4", "키즈카페", "박물관", "공원"],
};

export async function fetchHomeCardsByTab(
  tab: HomeTabKey,
  take: number = 5
): Promise<HomeCard[]> {
  const prefetch = Math.max(take * 40, 200);

  try {
    let q = supabase.from("stores").select("*").limit(prefetch);

    if (tab !== "all") {
      const candidates = TAB_CATEGORY_CANDIDATES[tab];
      const orStr = candidates.map((v) => `category.eq.${v}`).join(",");
      q = q.or(orStr);
    }

    const { data, error } = await q;

    if (error) {
      console.error("fetchHomeCardsByTab error:", error);
      return [];
    }
    if (!data || data.length === 0) return [];

    const cards = (data as StoreRecord[]).map(mapStoreToHomeCard);
    return shuffle(cards).slice(0, take);
  } catch (e) {
    console.error("fetchHomeCardsByTab exception:", e);
    return [];
  }
}
