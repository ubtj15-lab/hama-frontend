import type { HomeCard } from "@/lib/storeTypes";
import type { StoreRow } from "@/lib/storeRepository";
import { toHomeCard } from "@/lib/storeRepository";
import { inferNeutralRecommendationVoice } from "@/lib/recommend/scoring";
import type { RecommendScenarioKey } from "@/lib/recommend/scenarioWeights";

export const HOME_TRUST_PICK_MAX = 3;

/** API 실패·빈 데이터 시에만 쓰는 시나리오 시드(장소 아님 → 결과로 이동). */
export type TrustScenarioSeed = {
  id: string;
  title: string;
  tags: string[];
  query: string;
};

export const TRUST_SCENARIO_SEEDS: TrustScenarioSeed[] = [
  { id: "seed-1", title: "점심 메뉴 정하기", tags: ["점심", "가까움", "가성비"], query: "점심 뭐 먹지" },
  { id: "seed-2", title: "주말 브런치", tags: ["브런치", "분위기", "카페"], query: "브런치 맛집 추천" },
  { id: "seed-3", title: "가족 외식", tags: ["아이랑", "넓은 곳", "식사"], query: "아이랑 밥 먹기 좋은 곳" },
];

type ScoredPick = {
  card: HomeCard;
  voice: RecommendScenarioKey;
  cat: string;
};

function withInferredVoice(c: HomeCard): ScoredPick {
  const voice = c.recommendationVoice ?? inferNeutralRecommendationVoice(c);
  return {
    card: { ...c, recommendationVoice: voice },
    voice,
    cat: String(c.category ?? ""),
  };
}

/** 카테고리 + 시나리오 축이 겹치지 않게 최대 3장(가능하면 서로 다른 voice). */
export function pickDiverseHomeCards(cards: HomeCard[], max = HOME_TRUST_PICK_MAX): HomeCard[] {
  const pool = [...cards].filter((c) => c.name?.trim()).map(withInferredVoice);
  if (pool.length === 0) return [];

  const seen = new Set<string>();
  const out: HomeCard[] = [];
  const usedVoices = new Set<RecommendScenarioKey>();
  const preferOrder = ["restaurant", "cafe", "activity", "salon"] as const;

  const scorePick = (p: ScoredPick) => (usedVoices.has(p.voice) ? 1 : 0);

  for (const cat of preferOrder) {
    if (out.length >= max) break;
    const candidates = pool.filter((p) => p.cat === cat && !seen.has(p.card.id));
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => scorePick(a) - scorePick(b));
    const pick = candidates[0]!;
    out.push(pick.card);
    seen.add(pick.card.id);
    usedVoices.add(pick.voice);
  }

  while (out.length < max) {
    const rest = pool.filter((p) => !seen.has(p.card.id));
    if (rest.length === 0) break;
    rest.sort((a, b) => scorePick(a) - scorePick(b));
    const pick = rest[0]!;
    out.push(pick.card);
    seen.add(pick.card.id);
    usedVoices.add(pick.voice);
  }

  return out.slice(0, max);
}

export function shortTagsForTrustCard(card: HomeCard): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (!t || out.includes(t) || out.length >= 3) return;
    out.push(t);
  };

  push(card.categoryLabel ?? "");

  const pl = String(card.price_level ?? "").toLowerCase();
  if (pl === "low" || pl === "1" || pl === "budget") push("가성비");

  if (card.with_kids === true) push("아이랑");

  const moodLabels: Record<string, string> = {
    calm: "조용함",
    quiet: "조용함",
    cozy: "아늑함",
    date: "데이트",
    kids: "아이랑",
    family: "가족",
  };

  for (const m of card.mood ?? []) {
    push(moodLabels[m] ?? m);
    if (out.length >= 3) break;
  }

  for (const t of card.tags ?? []) {
    push(String(t));
    if (out.length >= 3) break;
  }

  if (out.length === 0) push("추천");
  if (out.length === 1) push("가까움");

  return out.slice(0, 3);
}

export async function fetchTrustPickPlaceCards(count = 12): Promise<HomeCard[]> {
  const mapRows = (items: StoreRow[]) => items.map((r) => toHomeCard(r));

  try {
    const res = await fetch(`/api/home-recommend?tab=all&count=${encodeURIComponent(String(count))}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as { items?: StoreRow[] };
      const items = json.items ?? [];
      if (items.length > 0) return mapRows(items as StoreRow[]);
    }
  } catch {
    // 다음 폴백으로
  }

  /** home-recommend 가 비었거나 실패 시(환경·필터 등) 동일 DB의 단순 목록 시도 */
  try {
    const res = await fetch(`/api/stores/home`, { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as { items?: StoreRow[] };
      const items = json.items ?? [];
      if (items.length > 0) return mapRows(items as StoreRow[]);
    }
  } catch {
    // ignore
  }

  return [];
}
