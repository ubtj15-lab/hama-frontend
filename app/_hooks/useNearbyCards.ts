"use client";

import { useEffect, useState } from "react";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import type { IntentionType } from "@/lib/intention";

type LatLng = { lat: number; lng: number } | null | undefined;

type Result = {
  cards: HomeCard[];
  isLoading: boolean;
};

const PER_CATEGORY = 5;
const POOL_SIZE = 40;

function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandomN<T>(array: T[], n: number): T[] {
  if (!Array.isArray(array) || array.length === 0) return [];
  return shuffle(array).slice(0, Math.min(n, array.length));
}

function norm(s: any): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(card: HomeCard): string {
  const c: any = card as any;
  const parts: string[] = [];
  if (c?.name) parts.push(String(c.name));
  if (c?.category) parts.push(String(c.category));
  if (Array.isArray(c?.tags)) parts.push(c.tags.join(" "));
  if (Array.isArray(c?.mood)) parts.push(c.mood.join(" "));
  if (c?.moodText) parts.push(String(c.moodText));
  return norm(parts.join(" "));
}

/** ✅ 추천 이유 한 줄 생성 */
function makeReasonText(card: HomeCard, intent: IntentionType): string {
  const c: any = card as any;
  const category = String(c?.category ?? "").toLowerCase();
  const text = tokenize(card);
  const has = (re: RegExp) => re.test(text);

  if (!intent || intent === "none") {
    const fallback = String(c?.moodText ?? "").trim();
    return fallback || "지금 위치에서 가까운 곳 위주로 골랐어";
  }

  if (intent === "solo") {
    if (has(/혼밥|혼자/)) return "혼밥하기 편한 곳 위주로 골랐어";
    if (has(/간단|빠르|가성비|점심/)) return "빠르게 먹기 좋은 곳 위주로 골랐어";
    if (category === "cafe") return "혼자 있어도 부담 없는 카페 위주로 골랐어";
    return "혼자 가기 좋은 조건 위주로 골랐어";
  }

  if (intent === "date") {
    if (has(/분위기|로맨틱|조용|야경/)) return "데이트 분위기 좋은 곳 위주로 골랐어";
    if (has(/브런치|디저트/)) return "데이트에 어울리는 디저트/브런치 위주로 골랐어";
    if (category === "cafe") return "데이트하기 좋은 카페 위주로 골랐어";
    return "둘이 가기 좋은 분위기 위주로 골랐어";
  }

  if (intent === "family") {
    if (has(/아이|키즈|유아|어린이/)) return "가족/아이랑 가기 좋은 곳 위주로 골랐어";
    if (has(/주차|넓/)) return "가족 이동 편한(주차/공간) 곳 위주로 골랐어";
    return "가족이 편하게 즐길 수 있는 곳 위주로 골랐어";
  }

  if (intent === "meeting") {
    if (has(/단체|모임|회식/)) return "모임/회식하기 좋은 곳 위주로 골랐어";
    if (has(/룸/)) return "단체로 앉기 편한(룸/좌석) 곳 위주로 골랐어";
    if (has(/술|한잔|이자카야|포차/)) return "한잔하기 좋은 분위기 위주로 골랐어";
    return "같이 가기 좋은(모임) 조건 위주로 골랐어";
  }

  return "지금 상황에 맞는 곳 위주로 골랐어";
}

function baseScore(card: HomeCard): number {
  const c: any = card as any;
  const curated = typeof c?.curated_score === "number" ? c.curated_score : 0;

  // 근처는 거리도 조금 반영(가까울수록 +)
  const distanceKm = typeof c?.distanceKm === "number" ? c.distanceKm : null;
  const distanceBoost = typeof distanceKm === "number" ? Math.max(0, 6 - distanceKm) : 0;

  return curated * 0.8 + distanceBoost;
}

function intentScore(card: HomeCard, intent: IntentionType): number {
  if (!intent || intent === "none") return 0;
  const text = tokenize(card);

  // 간단 룰 (정교한 건 다음 단계에서)
  let score = 0;

  if (intent === "solo") {
    if (/혼밥|혼자|간단|빠르|가성비|점심/.test(text)) score += 8;
    if (/단체|회식|키즈|아이/.test(text)) score -= 6;
  } else if (intent === "date") {
    if (/데이트|커플|분위기|로맨틱|조용|야경|디저트|브런치/.test(text)) score += 8;
    if (/단체|회식|2차|3차/.test(text)) score -= 6;
  } else if (intent === "family") {
    if (/가족|아이|키즈|유아|주차|넓/.test(text)) score += 8;
    if (/2차|3차|혼술/.test(text)) score -= 6;
  } else if (intent === "meeting") {
    if (/회식|모임|단체|룸|술|한잔|이자카야|고기/.test(text)) score += 8;
    if (/혼밥|조용|키즈|유아/.test(text)) score -= 6;
  }

  return score;
}

function rankAndPick(pool: HomeCard[], intent: IntentionType, n: number): HomeCard[] {
  const ranked = pool
    .map((card) => {
      const jitter = Math.random() * 5;
      const score = baseScore(card) + intentScore(card, intent) + jitter;
      return { card, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.card);

  const top = ranked.slice(0, Math.min(20, ranked.length));
  return pickRandomN(top, n).map((card) => ({ ...(card as any), reasonText: makeReasonText(card, intent) }));
}

async function fetchNearbyPoolFromApi(params: {
  lat: number;
  lng: number;
  tab: Exclude<HomeTabKey, "all">;
  radiusKm?: number;
  limit?: number;
}): Promise<HomeCard[]> {
  const url = new URL("/api/places/nearby", window.location.origin);
  url.searchParams.set("lat", String(params.lat));
  url.searchParams.set("lng", String(params.lng));
  url.searchParams.set("tab", params.tab);
  url.searchParams.set("radiusKm", String(params.radiusKm ?? 4));
  url.searchParams.set("limit", String(params.limit ?? POOL_SIZE));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];

  const json = await res.json();
  if (!json?.ok) return [];
  return Array.isArray(json.cards) ? (json.cards as HomeCard[]) : [];
}

async function fetchNearbyCategorySmart(
  loc: { lat: number; lng: number },
  tab: Exclude<HomeTabKey, "all">,
  intent: IntentionType
): Promise<HomeCard[]> {
  const pool = await fetchNearbyPoolFromApi({
    lat: loc.lat,
    lng: loc.lng,
    tab,
    limit: POOL_SIZE,
  });

  return rankAndPick(pool, intent, PER_CATEGORY);
}

async function fetchAllMixedNearby(loc: { lat: number; lng: number }, intent: IntentionType) {
  const [restaurants, cafes, salons, activities] = await Promise.all([
    fetchNearbyCategorySmart(loc, "restaurant", intent),
    fetchNearbyCategorySmart(loc, "cafe", intent),
    fetchNearbyCategorySmart(loc, "salon", intent),
    fetchNearbyCategorySmart(loc, "activity", intent),
  ]);

  return [...restaurants, ...cafes, ...salons, ...activities];
}

export function useNearbyCards(
  tab: HomeTabKey,
  loc: LatLng,
  shuffleKey: number,
  intent: IntentionType
): Result {
  const [cards, setCards] = useState<HomeCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!loc?.lat || !loc?.lng) {
        setCards([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result =
          tab === "all"
            ? await fetchAllMixedNearby({ lat: loc.lat, lng: loc.lng }, intent)
            : await fetchNearbyCategorySmart(
                { lat: loc.lat, lng: loc.lng },
                tab as Exclude<HomeTabKey, "all">,
                intent
              );

        if (!cancelled) setCards(result);
      } catch (e) {
        console.error("[useNearbyCards]", e);
        if (!cancelled) setCards([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [tab, loc?.lat, loc?.lng, shuffleKey, intent]);

  return { cards, isLoading };
}
