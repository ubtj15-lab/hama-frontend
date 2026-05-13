import type { RecommendVertical } from "./normalizeRequest";

export type VerticalRuleSet = {
  allowKeywords: readonly string[];
  blockKeywords: readonly string[];
  allowCategoryCodes: readonly string[];
};

const RULES: Record<RecommendVertical, VerticalRuleSet> = {
  beauty: {
    allowKeywords: [
      "미용실",
      "헤어",
      "헤어샵",
      "네일",
      "네일샵",
      "피부관리",
      "에스테틱",
      "왁싱",
      "바버샵",
      "속눈썹",
      "메이크업",
    ],
    blockKeywords: [
      "카페",
      "키즈카페",
      "베이커리",
      "식당",
      "음식점",
      "도서관",
      "박물관",
      "공원",
      "키즈",
      "놀이",
      "액티비티",
      "문화센터",
      "전시",
      "디저트",
    ],
    allowCategoryCodes: ["salon", "beauty", "bk9"],
  },
  fitness: {
    allowKeywords: [
      "헬스장",
      "헬스",
      "피트니스",
      "필라테스",
      "요가",
      "체육관",
      "스포츠센터",
      "수영장",
      "클라이밍",
      "복싱",
      "태권도",
      "운동",
    ],
    blockKeywords: ["카페", "식당", "도서관", "박물관", "미용실", "베이커리", "키즈카페"],
    allowCategoryCodes: ["fitness", "gym", "sports", "activity"],
  },
  life: {
    allowKeywords: [
      "세탁소",
      "빨래방",
      "약국",
      "병원",
      "의원",
      "마트",
      "편의점",
      "은행",
      "수리",
      "정비",
      "문구",
      "생활",
      "주민센터",
      "관공서",
    ],
    blockKeywords: ["카페", "식당", "박물관", "도서관", "공원", "미용실", "키즈카페"],
    allowCategoryCodes: ["life", "living", "convenience", "pharmacy", "hospital", "mart"],
  },
  restaurant: {
    allowKeywords: [
      "식당",
      "음식점",
      "한식",
      "중식",
      "일식",
      "양식",
      "분식",
      "고기",
      "밥집",
      "맛집",
    ],
    blockKeywords: [],
    allowCategoryCodes: ["restaurant", "food", "fd6"],
  },
  cafe: {
    allowKeywords: ["카페", "커피", "디저트", "베이커리"],
    blockKeywords: [],
    allowCategoryCodes: ["cafe", "ce7"],
  },
  activity: {
    allowKeywords: ["공원", "박물관", "도서관", "키즈카페", "체험", "놀이", "문화", "전시", "산책"],
    blockKeywords: [],
    allowCategoryCodes: ["activity", "culture", "park", "museum", "library"],
  },
  all: {
    allowKeywords: [],
    blockKeywords: [],
    allowCategoryCodes: [],
  },
};

export function getVerticalRules(vertical: RecommendVertical): VerticalRuleSet {
  return RULES[vertical] ?? RULES.all;
}

/** strict vertical — 화이트리스트·차단 모두 적용 */
export function verticalUsesStrictWhitelist(vertical: RecommendVertical): boolean {
  return vertical === "beauty" || vertical === "fitness" || vertical === "life";
}
