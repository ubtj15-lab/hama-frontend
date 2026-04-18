/**
 * 시나리오별 headline / subline 사전 — 추천 카드·상세 배너·코스 UI에서 공통 사용.
 * 인덱스 i로 headline[i] ↔ subline[i]를 한 쌍으로 본다.
 *
 * 적용 예:
 * - `RecommendationCard` / `buildRecommendationReason` — `pickRecommendationPair` 내부 사용.
 * - 코스 카드(`CourseDeckCard`)에서 첫 정류장 카드로 문구를 붙일 때 동일하게
 *   `pickRecommendationPair({ scenario, serving, deckSlot, ... })` 또는
 *   `inferServingTypeForRecommendation(thumbCard)` 호출.
 */
import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendScenarioKey } from "@/lib/recommend/scenarioWeights";
import { inferFoodServingType, inferServingTypeForPlace } from "@/lib/scenarioEngine/courseServingType";
import { mapPlaceToPlaceType } from "@/lib/scenarioEngine/placeTypeMap";

export type RecommendationCopyKey = "date" | "family" | "solo" | "group" | "light";

export type ServingTypeForCopy = "meal" | "light" | "drink";

export type RecommendationCopyBundle = {
  headlines: string[];
  sublines: string[];
};

export const RECOMMENDATION_COPY: Record<RecommendationCopyKey, RecommendationCopyBundle> = {
  date: {
    headlines: [
      "데이트로 분위기 좋아요",
      "둘이 대화하기 좋아요",
      "연인과 가볍게 들르기 좋아요",
      "데이트 코스로 무난해요",
      "식사 후 이어가기 좋아요",
      "분위기 있는 데이트 장소예요",
      "조용하게 이야기 나누기 좋아요",
      "편하게 머물기 좋은 데이트 장소예요",
      "가볍게 시작하기 좋은 데이트 장소예요",
      "마무리 코스로 딱 좋아요",
    ],
    sublines: [
      "너무 시끄럽지 않아 대화하기 좋아요",
      "분위기가 차분해서 오래 머물기 좋아요",
      "식사 후 카페나 산책으로 이어가기 좋아요",
      "위치가 좋아서 다음 코스로 이동하기 편해요",
      "둘이 편하게 머물기 좋은 공간이에요",
      "부담 없이 들르기 좋은 분위기예요",
      "사진 찍기에도 괜찮은 분위기예요",
      "야외나 창가 자리에서 분위기 즐기기 좋아요",
      "동선이 자연스러워 코스로 이어가기 좋아요",
      "가볍게 시작하거나 마무리하기 좋아요",
    ],
  },
  family: {
    headlines: [
      "아이랑 가기 좋아요",
      "가족 외식으로 무난해요",
      "아이 동반 방문에 좋아요",
      "가족이 함께 들르기 좋아요",
      "부담 없이 가족끼리 가기 좋아요",
      "아이와 함께하기 편한 곳이에요",
      "가족 모임으로 괜찮아요",
      "아이랑 외출 코스로 좋아요",
      "가족 단위 방문에 잘 맞아요",
      "편하게 들르기 좋은 가족 장소예요",
    ],
    sublines: [
      "좌석과 동선이 넉넉해서 편해요",
      "아이와 함께 있어도 부담 없는 분위기예요",
      "메뉴 선택이 쉬운 편이에요",
      "대기나 이동이 비교적 편한 편이에요",
      "유모차 이동도 무난한 편이에요",
      "소음에 부담이 적은 분위기예요",
      "가족끼리 오래 머물기 괜찮아요",
      "아이와 식사하기 편한 구조예요",
      "전체적으로 안정적인 선택이에요",
      "가볍게 들르기 좋은 가족 코스예요",
    ],
  },
  solo: {
    headlines: [
      "혼자 가볍게 들르기 좋아요",
      "혼자 식사하기 편해요",
      "혼자 시간 보내기 좋아요",
      "부담 없이 들르기 좋아요",
      "잠깐 쉬어가기 좋아요",
      "빠르게 들렀다 나오기 좋아요",
      "혼자 조용히 있기 좋아요",
      "간단히 해결하기 좋아요",
      "혼자 여유롭게 머물기 좋아요",
      "혼자 카페 가기 좋아요",
    ],
    sublines: [
      "혼자 있어도 어색하지 않은 분위기예요",
      "빠르게 식사하거나 머물기 좋아요",
      "좌석 구조가 혼자 이용하기 편해요",
      "잠깐 들렀다 가기 좋은 곳이에요",
      "혼자 시간 보내기 부담 없어요",
      "조용하게 머물기 좋아요",
      "간단하게 해결하기 좋은 곳이에요",
      "대기 부담이 적은 편이에요",
      "혼자 작업하거나 쉬기 좋아요",
      "짧게 머물기 좋은 구조예요",
    ],
  },
  group: {
    headlines: [
      "여럿이 가기 좋아요",
      "모임 장소로 괜찮아요",
      "친구들이랑 가기 좋아요",
      "단체 방문에 좋아요",
      "가볍게 모이기 좋아요",
      "회식 장소로 무난해요",
      "편하게 이야기 나누기 좋아요",
      "여럿이 즐기기 좋아요",
      "분위기 편한 모임 장소예요",
      "같이 가기 좋은 곳이에요",
    ],
    sublines: [
      "좌석이 넉넉해서 모임하기 좋아요",
      "대화하기 편한 분위기예요",
      "여럿이 있어도 부담 없는 공간이에요",
      "단체로 방문하기 무난해요",
      "시끄럽지 않아 이야기하기 좋아요",
      "메뉴 선택이 쉬운 편이에요",
      "분위기가 편해서 오래 머물기 좋아요",
      "모임 후 이동하기도 편해요",
      "부담 없이 모이기 좋은 곳이에요",
      "가볍게 시작하기 좋은 장소예요",
    ],
  },
  light: {
    headlines: [
      "가볍게 들르기 좋아요",
      "커피 한잔 하기 좋아요",
      "잠깐 쉬어가기 좋아요",
      "디저트 즐기기 좋아요",
      "카페로 이어가기 좋아요",
      "간단히 머물기 좋아요",
      "가볍게 시작하기 좋아요",
      "짧게 들르기 좋은 곳이에요",
      "분위기 즐기기 좋아요",
      "카페 코스로 좋아요",
    ],
    sublines: [
      "잠깐 들렀다 가기 좋아요",
      "커피나 디저트 즐기기 좋아요",
      "가볍게 쉬어가기 좋은 곳이에요",
      "다음 코스로 이어가기 좋아요",
      "분위기 즐기기 좋은 공간이에요",
      "짧은 시간 머물기 좋아요",
      "부담 없이 들르기 좋아요",
      "간단히 쉬기 좋은 곳이에요",
      "카페 코스로 무난해요",
      "편하게 머물기 좋아요",
    ],
  },
};

function zipPairs(bundle: RecommendationCopyBundle): { headline: string; subline: string }[] {
  const n = Math.min(bundle.headlines.length, bundle.sublines.length);
  const out: { headline: string; subline: string }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ headline: bundle.headlines[i]!, subline: bundle.sublines[i]! });
  }
  return out;
}

/** 시나리오별로 절대 쓰면 안 되는 headline 패턴(해당 시나리오일 때) */
export const SCENARIO_HEADLINE_DENY: Record<RecommendScenarioKey, RegExp> = {
  date: /아이랑|혼자 가기 편해요|혼밥하기|가족 외식|아이 동반/,
  family: /데이트로 분위기|혼자 가기 편해요|둘이|연인과|데이트 코스/,
  solo: /아이랑 가기|데이트 코스로 무난|연인과|데이트로 분위기|가족 외식/,
  group: /^$/,
};

/** subline 에서도 시나리오와 충돌 시 제외 (부분 문자열 '아이' 단독은 아이스크림 등 오탐 방지) */
export const SCENARIO_SUBLINE_DENY: Record<RecommendScenarioKey, RegExp> = {
  date:
    /(?:아이동반|아이와|가족끼리|가족\s*외식|혼밥|혼자\s*식사|키즈|유아|어린이|가족\s*모임)/,
  family: /데이트|연인|둘이\s*편하게|둘이\s*대화|혼자\s*있어도|혼밥|혼자\s*시간/,
  solo: /데이트|연인|아이와|가족끼리|키즈|가족\s*외식|둘이\s*편하게/,
  group: /^$/,
};

/** drink 전용 금지(식사·혼밥 톤) — '가족 외식으로' 등 가벼운 외식 표현은 유지 */
const DRINK_MEAL_TONE: RegExp =
  /식사하기 좋아요|혼밥하기 좋아요|한\s*끼|점심으로|저녁\s*식사|정식|혼밥|식사\s*후|아이와\s*식사|회식\s*장소/;

/** meal/light 가 아닐 때 금지(빠른 식사 톤 subline) */
const FAST_MEAL_SUBLINE: RegExp = /빠르게\s*식사|빠른(게)?\s*식사하고/;

function pairAllowedForScenario(
  p: { headline: string; subline: string },
  scenario: RecommendScenarioKey | "light"
): boolean {
  if (scenario === "light") return true;
  if (SCENARIO_HEADLINE_DENY[scenario].test(p.headline)) return false;
  if (SCENARIO_SUBLINE_DENY[scenario].test(p.subline)) return false;
  return true;
}

function pairAllowedForDrink(p: { headline: string; subline: string }): boolean {
  if (DRINK_MEAL_TONE.test(p.headline) || DRINK_MEAL_TONE.test(p.subline)) return false;
  return true;
}

function pairAllowedForFastMealRule(p: { headline: string; subline: string }, serving: ServingTypeForCopy): boolean {
  if (serving === "meal" || serving === "light") return true;
  if (FAST_MEAL_SUBLINE.test(p.subline) || FAST_MEAL_SUBLINE.test(p.headline)) return false;
  return true;
}

/**
 * 카드·카테고리로 meal / light / drink 추론 (카피·금지 규칙용).
 * HomeCard.servingType 이 있으면 우선.
 */
export function inferServingTypeForRecommendation(card: HomeCard): ServingTypeForCopy {
  const o = card.servingType;
  if (o === "meal" || o === "light" || o === "drink") return o;

  const pt = mapPlaceToPlaceType(card);
  if (pt === "CAFE") return inferServingTypeForPlace(card, "CAFE");
  if (pt === "FOOD" || String(card.category ?? "").toLowerCase() === "restaurant") {
    return inferFoodServingType(card);
  }
  return "light";
}

export type PickRecommendationPairInput = {
  /** 미지정 시나리오 폴백은 `light` 카피 풀 */
  scenario: RecommendScenarioKey | "light";
  serving: ServingTypeForCopy;
  deckSlot: number;
  usedHeadlines?: Set<string>;
  usedSublines?: Set<string>;
};

/**
 * 시나리오·serving에 맞는 (headline, subline) 쌍 선택.
 * - solo + drink → light 풀
 * - drink → 식사형 문구 제거
 * - used 세트에 없는 쌍을 우선(덱 variation)
 */
export function pickRecommendationPair(input: PickRecommendationPairInput): { headline: string; subline: string } {
  const { scenario, serving, deckSlot, usedHeadlines, usedSublines } = input;

  let baseKey: RecommendationCopyKey;
  if (scenario === "light") {
    baseKey = "light";
  } else if (serving === "drink" && scenario === "solo") {
    baseKey = "light";
  } else {
    baseKey = scenario as RecommendationCopyKey;
  }

  let pairs = zipPairs(RECOMMENDATION_COPY[baseKey]);

  pairs = pairs.filter((p) => pairAllowedForScenario(p, scenario));

  if (serving === "drink") {
    pairs = pairs.filter(pairAllowedForDrink);
  }

  pairs = pairs.filter((p) => pairAllowedForFastMealRule(p, serving));

  if (pairs.length === 0) {
    pairs = zipPairs(RECOMMENDATION_COPY.light)
      .filter((p) => pairAllowedForScenario(p, scenario))
      .filter(pairAllowedForDrink)
      .filter((p) => pairAllowedForFastMealRule(p, serving));
  }
  if (pairs.length === 0) {
    pairs = zipPairs(RECOMMENDATION_COPY.light).filter((p) => pairAllowedForScenario(p, scenario));
  }

  const tryOrder = (pool: { headline: string; subline: string }[]) => {
    const n = pool.length;
    if (n === 0) return null;
    for (let k = 0; k < n; k++) {
      const idx = (deckSlot + k) % n;
      const p = pool[idx]!;
      if (usedHeadlines?.has(p.headline)) continue;
      if (usedSublines?.has(p.subline)) continue;
      usedHeadlines?.add(p.headline);
      usedSublines?.add(p.subline);
      return p;
    }
    for (let k = 0; k < n; k++) {
      const p = pool[(deckSlot + k) % n]!;
      if (!usedHeadlines?.has(p.headline)) {
        usedHeadlines?.add(p.headline);
        usedSublines?.add(p.subline);
        return p;
      }
    }
    const fallback = pool[deckSlot % n]!;
    usedHeadlines?.add(fallback.headline);
    usedSublines?.add(fallback.subline);
    return fallback;
  };

  const picked = tryOrder(pairs);
  if (picked) return picked;

  return {
    headline: "오늘 가기 좋은 곳이에요",
    subline: "이 근처에서 무난하게 즐기기 좋아요",
  };
}
