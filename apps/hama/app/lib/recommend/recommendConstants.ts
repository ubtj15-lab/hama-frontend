/** 홈 추천 후보 풀 (탭별) */
export const RECOMMEND_POOL_SINGLE_TAB = 120;
export const RECOMMEND_POOL_PER_CATEGORY_MIXED = 55;

/** 화면에 고정 노출할 추천 장 수 */
export const RECOMMEND_DECK_SIZE = 3;

/** 최근 본 카드는 상위 N개만 후보에서 제외 */
export const RECENT_EXCLUDE_LIMIT = 8;

/**
 * 최종 점수 (각 항목은 0~100)
 */
export const WEIGHT_DISTANCE = 0.3;
export const WEIGHT_SCENARIO = 0.3;
export const WEIGHT_BUSINESS = 0.2;
export const WEIGHT_QUALITY = 0.1;
export const WEIGHT_KEYWORD = 0.07;
export const WEIGHT_BONUS = 0.03;

/** 거리 알 수 없을 때 거리 점수 (0~100) */
export const DISTANCE_SCORE_WHEN_UNKNOWN = 45;

/** 다양성: 이미 뽑은 카드와 겹칠 때 finalScore에서 감점 */
export const DIVERSITY_PENALTY_SAME_MAIN_CATEGORY = 12;
export const DIVERSITY_PENALTY_SAME_SUB_CATEGORY = 8;
export const DIVERSITY_PENALTY_SAME_BRAND = 15;
