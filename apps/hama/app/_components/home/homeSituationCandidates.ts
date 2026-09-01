/**
 * Home-only situation candidate library.
 * Queries are existing frozen-engine inputs. No new recommendation semantics.
 */

export type HomeSemanticFamily =
  | "family"
  | "date"
  | "food"
  | "outdoor"
  | "indoor"
  | "culture"
  | "relax"
  | "discovery";

export type HomeDaypart = "morning" | "lunch" | "afternoon" | "evening";

export type HomeSituationCandidate = {
  id: string;
  displayTitle: string;
  line1: string;
  line2: string;
  icon: string;
  query: string;
  semanticFamily: HomeSemanticFamily;
  /** Optional future UI. V4.1 must leave this unset. */
  reasonLabel?: string;
  contextHints?: {
    dayparts?: HomeDaypart[];
    weekend?: boolean;
    rainy?: boolean;
  };
  personalizationHints?: {
    companion?: string[];
    preferenceTags?: string[];
    novelty?: "same" | "new" | "mixed";
  };
};

/** Future contract only. V4.1 production Home passes empty. */
export type HomePersonalizationContext = {
  preferredSemanticFamilies?: HomeSemanticFamily[];
  recentSemanticFamilies?: HomeSemanticFamily[];
  companionHints?: string[];
  noveltyPreference?: "same" | "new" | "mixed";
};

export const EMPTY_HOME_PERSONALIZATION: HomePersonalizationContext = {};

export const MAX_HOME_SITUATION_SLOTS = 4;

export const HOME_SITUATION_CANDIDATES: HomeSituationCandidate[] = [
  {
    id: "family_outing",
    displayTitle: "아이들이랑 나들이 갈까?",
    line1: "아이들이랑",
    line2: "나들이 갈까?",
    icon: "👨‍👩‍👧",
    query: "아이랑 갈만한 곳",
    semanticFamily: "family",
  },
  {
    id: "date",
    displayTitle: "오늘은 데이트 어때요?",
    line1: "오늘은",
    line2: "데이트 어때요?",
    icon: "💜",
    query: "데이트",
    semanticFamily: "date",
  },
  {
    id: "food",
    displayTitle: "맛있는 거 먹을까?",
    line1: "맛있는 거",
    line2: "먹을까?",
    icon: "🍜",
    query: "뭐 먹지",
    semanticFamily: "food",
  },
  {
    id: "outdoor_walk",
    displayTitle: "잠깐 바람 쐬고 올까?",
    line1: "잠깐",
    line2: "바람 쐬고 올까?",
    icon: "🌿",
    query: "산책하다 들를 곳",
    semanticFamily: "outdoor",
  },
  {
    id: "indoor",
    displayTitle: "오늘은 실내에서 놀까?",
    line1: "오늘은",
    line2: "실내에서 놀까?",
    icon: "🏠",
    query: "실내",
    semanticFamily: "indoor",
  },
  {
    id: "culture",
    displayTitle: "오늘 문화생활 어때요?",
    line1: "오늘",
    line2: "문화생활 어때요?",
    icon: "🎭",
    query: "문화 공연 전시",
    semanticFamily: "culture",
  },
  {
    id: "relax",
    displayTitle: "조용히 쉬다 올까?",
    line1: "조용히",
    line2: "쉬다 올까?",
    icon: "😌",
    query: "조용히 시간 보낼 곳",
    semanticFamily: "relax",
  },
  {
    id: "discovery",
    displayTitle: "새로운 데 가볼까?",
    line1: "새로운 데",
    line2: "가볼까?",
    icon: "✨",
    query: "어디 갈까",
    semanticFamily: "discovery",
  },
  {
    id: "family_meal",
    displayTitle: "아이랑 밥 먹으러 갈까?",
    line1: "아이랑",
    line2: "밥 먹으러 갈까?",
    icon: "🍽️",
    query: "아이랑 밥 먹기 좋은 곳",
    semanticFamily: "family",
    personalizationHints: { companion: ["아이"], preferenceTags: ["meal"] },
  },
  {
    id: "cafe_sweet",
    displayTitle: "달달한 거 먹으러 갈까?",
    line1: "달달한 거",
    line2: "먹으러 갈까?",
    icon: "🍮",
    query: "달달한 거 먹고 싶어",
    semanticFamily: "food",
    contextHints: { dayparts: ["afternoon"] },
  },
  {
    id: "date_sweet",
    displayTitle: "둘이 달달한 거 어때요?",
    line1: "둘이",
    line2: "달달한 거 어때요?",
    icon: "💜",
    query: "달달한 거 먹으며 데이트",
    semanticFamily: "date",
  },
  {
    id: "solo",
    displayTitle: "혼자만의 시간 어때요?",
    line1: "혼자만의",
    line2: "시간 어때요?",
    icon: "🌙",
    query: "혼자 가기 좋은 곳",
    semanticFamily: "relax",
  },
  {
    id: "boredom",
    displayTitle: "심심한데 뭐 하지?",
    line1: "심심한데",
    line2: "뭐 하지?",
    icon: "💭",
    query: "심심한데 뭐하지",
    semanticFamily: "discovery",
  },
  {
    id: "indoor_rain",
    displayTitle: "비 오는 날 실내에서?",
    line1: "비 오는 날",
    line2: "실내에서?",
    icon: "☔",
    query: "비 오는 날 실내",
    semanticFamily: "indoor",
    contextHints: { rainy: true },
  },
];

export const DEFAULT_HOME_SLOT_IDS = ["family_outing", "date", "food", "outdoor_walk"] as const;

export function getHomeSituationCandidate(id: string): HomeSituationCandidate | undefined {
  return HOME_SITUATION_CANDIDATES.find((c) => c.id === id);
}
