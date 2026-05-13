import type { HomeCard } from "@/lib/storeTypes";
import type { IntentCategory } from "@/lib/scenarioEngine/types";
import { buildRecommendationReason, getClientTimeOfDay } from "@/lib/recommend/buildRecommendationReason";
import type { RecommendVertical } from "./normalizeRequest";

const VERTICAL_DEFAULT_LINE: Record<RecommendVertical, string> = {
  beauty: "헤어/뷰티 목적에 맞는 매장이에요",
  fitness: "운동 목적에 맞는 장소예요",
  life: "생활 편의 목적에 맞는 장소예요",
  cafe: "카페 이용 목적에 맞는 장소예요",
  restaurant: "식사 목적에 맞는 장소예요",
  activity: "나들이/체험 목적에 맞는 장소예요",
  all: "이번 검색에 맞는 장소예요",
};

function intentCategoryForVertical(v: RecommendVertical): IntentCategory | undefined {
  switch (v) {
    case "beauty":
      return "BEAUTY";
    case "fitness":
      return "FITNESS";
    case "life":
      return "LIFE";
    case "cafe":
      return "CAFE";
    case "restaurant":
      return "FOOD";
    case "activity":
      return "ACTIVITY";
    default:
      return undefined;
  }
}

/**
 * v2 카드에 `reasonText`(로그·분석용)와 `buildRecommendationReason` 기반 배지 보조를 붙인다.
 * 결과 카드 UI는 기존 `RecommendationCard` + `useDeckRecommendationReasons`가 그대로 렌더한다.
 */
export function applyRecommendV2Reasons(
  cards: HomeCard[],
  vertical: RecommendVertical,
  scenarioStub?: { intentCategory?: IntentCategory; beautySubCategory?: "hair" | "nail" | "eyelash" | "waxing" } | null
): HomeCard[] {
  const base = VERTICAL_DEFAULT_LINE[vertical] ?? VERTICAL_DEFAULT_LINE.all;
  const intentCategory = scenarioStub?.intentCategory ?? intentCategoryForVertical(vertical);

  return cards.map((card, i) => {
    const block = buildRecommendationReason(card, {
      deckSlot: i,
      timeOfDay: getClientTimeOfDay(),
      intentCategory,
      beautySubCategory: scenarioStub?.beautySubCategory,
    });
    const reasonText = `${base} ${block.headline}`.replace(/\s+/g, " ").trim().slice(0, 220);
    return {
      ...card,
      reasonText,
    };
  });
}

export function verticalDefaultReasonLine(vertical: RecommendVertical): string {
  return VERTICAL_DEFAULT_LINE[vertical] ?? VERTICAL_DEFAULT_LINE.all;
}
