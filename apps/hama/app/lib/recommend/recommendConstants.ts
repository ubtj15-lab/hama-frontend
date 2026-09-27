/** 홈 추천 후보 풀 (탭별) */
export const RECOMMEND_POOL_SINGLE_TAB = 120;
export const RECOMMEND_POOL_PER_CATEGORY_MIXED = 55;

/** 화면에 고정 노출할 추천 장 수 */
export const RECOMMEND_DECK_SIZE = 3;

/** 최근 본 카드는 상위 N개만 후보에서 제외 */
export const RECENT_EXCLUDE_LIMIT = 8;

/**
 * 하이브리드 최종 점수 (각 항목 0~100 스케일)
 * distance + rating + scenario + convenience + behavior_boost (=1.0)
 */
export const HYBRID_WEIGHT_DISTANCE = 0.15;
export const HYBRID_WEIGHT_RATING = 0.1;
export const HYBRID_WEIGHT_SCENARIO = 0.25;
export const HYBRID_WEIGHT_CONVENIENCE = 0.1;
export const HYBRID_WEIGHT_BEHAVIOR = 0.1;
export const HYBRID_WEIGHT_PERSONAL = 0.3;

/**
 * 최종 점수 (각 항목은 0~100) — 랭킹 내부 보조·레거시 호환
 */
export const WEIGHT_DISTANCE = 0.26;
export const WEIGHT_SCENARIO = 0.18;
export const WEIGHT_BUSINESS = 0.15;
export const WEIGHT_QUALITY = 0.09;
export const WEIGHT_KEYWORD = 0.05;
export const WEIGHT_BONUS = 0.02;
/** search_strict + FOOD + (menuIntent | foodSubCategory) 일 때만 가산 */
export const WEIGHT_FOOD_INTENT = 0.17;
/**
 * 명시 메뉴 query(menuIntent 있음)에서 scenarioRich에 섞는 메뉴 비중.
 * 일반 FOOD 서브카테고리만 있는 경우는 WEIGHT_FOOD_INTENT 근처의 기존 0.18을 유지.
 */
export const EXPLICIT_MENU_FOOD_BLEND = 0.58;
export const IMPLICIT_FOOD_BLEND = 0.18;
/** 명시 메뉴일 때 hybrid 위에 더하는 relevance boost (0~100 스케일) */
export const MENU_RANK_BOOST_EXACT = 26;
export const MENU_RANK_BOOST_SYNONYM = 20;
export const MENU_RANK_BOOST_SEMANTIC = 8;
/** 풀에 강한 메뉴 매치가 있을 때 generic(무매치) 후보 감점 */
export const MENU_RANK_GENERIC_PENALTY = 18;
/** 복합 의도(취향·시나리오 fit·hard/soft·시간대) */
export const WEIGHT_COMPOSITE = 0.08;
/** 가족·아이 시나리오 랭킹 — childFriendlyScore(0~1) 가산 */
export const WEIGHT_CHILD_FRIENDLY = 0.1;

/** 거리 알 수 없을 때 거리 점수 (0~100) */
export const DISTANCE_SCORE_WHEN_UNKNOWN = 45;

/** 다양성: 이미 뽑은 카드와 겹칠 때 finalScore에서 감점 */
export const DIVERSITY_PENALTY_SAME_MAIN_CATEGORY = 12;
export const DIVERSITY_PENALTY_SAME_SUB_CATEGORY = 8;
export const DIVERSITY_PENALTY_SAME_BRAND = 15;
/** 동일 시나리오 축(date/family/solo/group) 반복 억제 */
export const DIVERSITY_PENALTY_SAME_SCENARIO_VOICE = 30;
