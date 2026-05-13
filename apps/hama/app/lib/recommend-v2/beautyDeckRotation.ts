import type { HomeCard } from "@/lib/storeTypes";
import {
  BEAUTY_V2_EXPOSURE_EXCLUDE_COUNT,
  beautyExposureId,
  readBeautyRecentExposureIds,
} from "./beautyRecentExposure";

const TOP_SCORE_POOL = 20;

function shufflePickUnique(cards: HomeCard[], n: number, rng: () => number): HomeCard[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
  return arr.slice(0, Math.min(n, arr.length));
}

export type BeautyV2RotationPickMeta = {
  candidateCount: number;
  scoredPoolCount: number;
  recentExcludedCount: number;
  relaxRecent: boolean;
};

/**
 * score 정렬된 `pool`에서 상위 20장 안에서 랜덤 3장 후보를 뽑고,
 * `filterDeck`으로 최종 통과하는 덱을 찾는다. 최근 노출 id는 우선 제외(부족 시 완화).
 */
export function pickBeautyV2RotationDeck(
  pool: HomeCard[],
  deckSize: number,
  filterDeck: (picked: HomeCard[]) => HomeCard[],
  options?: { rng?: () => number; maxAttempts?: number }
): { deck: HomeCard[]; meta: BeautyV2RotationPickMeta } {
  const rng = options?.rng ?? Math.random;
  const maxAttempts = options?.maxAttempts ?? 28;
  const candidateCount = pool.length;
  const topPool = pool.slice(0, TOP_SCORE_POOL);
  const scoredPoolCount = topPool.length;

  const recentBlock = new Set(readBeautyRecentExposureIds().slice(0, BEAUTY_V2_EXPOSURE_EXCLUDE_COUNT));
  const recentInTop = topPool.filter((c) => recentBlock.has(beautyExposureId(c))).length;

  let relaxRecent = false;
  let pickSource = topPool.filter((c) => !recentBlock.has(beautyExposureId(c)));
  if (pickSource.length < deckSize) {
    pickSource = topPool;
    relaxRecent = true;
  }

  const trySize = Math.min(deckSize, pickSource.length);
  for (let a = 0; a < maxAttempts; a++) {
    const raw = shufflePickUnique(pickSource, trySize, rng);
    const ok = filterDeck(raw);
    if (ok.length >= deckSize) {
      return {
        deck: ok.slice(0, deckSize),
        meta: {
          candidateCount,
          scoredPoolCount,
          recentExcludedCount: recentInTop,
          relaxRecent,
        },
      };
    }
  }

  const wide = filterDeck(pool.slice(0, Math.min(80, pool.length)));
  if (wide.length >= deckSize) {
    const deck = shufflePickUnique(wide, deckSize, rng);
    return {
      deck,
      meta: {
        candidateCount,
        scoredPoolCount,
        recentExcludedCount: recentInTop,
        relaxRecent: true,
      },
    };
  }

  return {
    deck: wide.slice(0, deckSize),
    meta: {
      candidateCount,
      scoredPoolCount,
      recentExcludedCount: recentInTop,
      relaxRecent: true,
    },
  };
}
