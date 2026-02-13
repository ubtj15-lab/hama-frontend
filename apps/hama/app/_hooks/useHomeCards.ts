"use client";

import { useEffect, useState } from "react";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { fetchHomeCardsByTab } from "@/lib/storeRepository";
import type { IntentionType } from "@/lib/intention";

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

type IntentRule = { pos: RegExp[]; neg?: RegExp[] };

const INTENT_HINTS: Record<Exclude<IntentionType, "none">, IntentRule> = {
  date: {
    pos: [/데이트|커플|로맨틱|분위기|조용|야경|와인|파스타|스테이크|브런치|디저트|카페/],
    neg: [/단체|회식|뒤풀이|2차|3차/],
  },
  solo: {
    pos: [/혼밥|혼자|간단|빠르|가성비|점심|분식|국밥|백반|김밥|혼술/],
    neg: [/단체|회식|키즈|아이/],
  },
  family: {
    pos: [/가족|아이|키즈|유아|어린이|부모님|넓|주차|한식|백반|공원|박물관/],
    neg: [/2차|3차|이자카야|혼술/],
  },
  meeting: {
    pos: [/회식|모임|단체|룸|술|한잔|이자카야|고기|삼겹|갈비|맥주|소주|포차/],
    neg: [/혼밥|조용|키즈|유아/],
  },
};

function baseScore(card: HomeCard): number {
  const c: any = card as any;
  const curated = typeof c?.curated_score === "number" ? c.curated_score : 0;
  // 운영자 점수는 "신뢰 베이스"로만 살짝
  return curated * 1.0;
}

function intentScore(card: HomeCard, intent: IntentionType): number {
  if (!intent || intent === "none") return 0;
  const text = tokenize(card);
  const rule = INTENT_HINTS[intent as Exclude<IntentionType, "none">];
  if (!rule) return 0;

  let score = 0;
  for (const r of rule.pos) if (r.test(text)) score += 6;
  for (const r of rule.neg ?? []) if (r.test(text)) score -= 5;
  return score;
}

/** ✅ 추천 이유 한 줄 생성 */
function makeReasonText(card: HomeCard, intent: IntentionType): string {
  const c: any = card as any;
  const category = String(c?.category ?? "").toLowerCase();
  const text = tokenize(card);

  // 의도 없으면 기존 moodText를 이유처럼 사용
  if (!intent || intent === "none") {
    const fallback = String(c?.moodText ?? "").trim();
    return fallback || "지금 보기 좋은 곳 위주로 골랐어";
  }

  const has = (re: RegExp) => re.test(text);

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

function decorate(pool: HomeCard[], intent: IntentionType): HomeCard[] {
  return pool.map((card) => {
    const reasonText = makeReasonText(card, intent);
    return { ...(card as any), reasonText } as HomeCard;
  });
}

function rankAndPick(pool: HomeCard[], intent: IntentionType, n: number): HomeCard[] {
  const ranked = pool
    .map((card) => {
      const jitter = Math.random() * 5; // ✅ 고정 방지 노이즈
      const score = baseScore(card) + intentScore(card, intent) + jitter;
      return { card, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.card);

  const top = ranked.slice(0, Math.min(20, ranked.length));
  return pickRandomN(top, n);
}

async function fetchCategorySmart(tab: Exclude<HomeTabKey, "all">, intent: IntentionType) {
  const pool = await fetchHomeCardsByTab(tab, { count: POOL_SIZE });
  const picked = rankAndPick(pool, intent, PER_CATEGORY);
  return decorate(picked, intent);
}

async function fetchAllMixedRecommend(intent: IntentionType): Promise<HomeCard[]> {
  const [restaurants, cafes, salons, activities] = await Promise.all([
    fetchCategorySmart("restaurant", intent),
    fetchCategorySmart("cafe", intent),
    fetchCategorySmart("salon", intent),
    fetchCategorySmart("activity", intent),
  ]);

  const merged = [...restaurants, ...cafes, ...salons, ...activities];
  return shuffle(merged);
}

export function useHomeCards(tab: HomeTabKey, shuffleKey: number, intent: IntentionType): Result {
  const [cards, setCards] = useState<HomeCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      try {
        const result =
          tab === "all"
            ? await fetchAllMixedRecommend(intent)
            : await fetchCategorySmart(tab as Exclude<HomeTabKey, "all">, intent);

        if (!cancelled) setCards(result);
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
  }, [tab, shuffleKey, intent]);

  return { cards, isLoading };
}
