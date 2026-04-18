/**
 * 이벤트 1회당 behaviorScore 기여 (패턴·코스 집계에 합산)
 * 강한 긍정 > 약한 긍정 > 부정
 */
export const COURSE_LEARNING_EVENT_WEIGHTS: Record<string, number> = {
  course_impression: 0,
  course_start_click: 5,
  course_save: 4,
  first_place_route_click: 4,
  course_place_detail_click: 2,
  course_call_click: 2,
  course_card_click: 1,
  course_detail_view: 1,
  long_view_time: 1,
  immediate_exit: -3,
  no_action_after_impression: -1,
  repeated_skip: -2,
};

/** rule-based 점수 대비 학습 보정 상한 (0~100 스케일에 가산되는 포인트) */
export const LEARNED_BOOST_MAX_TOTAL = 12;

export const LEARNED_TEMPLATE_MAX = 5;
export const LEARNED_SCENARIO_PATTERN_MAX = 4;
export const LEARNED_PLACE_MAX = 4;
export const LEARNED_FEATURE_MAX = 2;

/** 이 인상 이상이면 학습 가중 full. 미만이면 선형 완화 */
export const MIN_IMPRESSIONS_FULL_WEIGHT = 20;

/** 최소 인상 — 그 미만은 boost 거의 없음 */
export const MIN_IMPRESSIONS_ANY = 3;

/** 클릭률·출발률 등에 곱하는 스무딩 */
export const SMOOTHING_M = 2;

/** 최근 이벤트 가중 (선택): store에서 decay 적용 시 */
export const RECENT_HALF_LIFE_DAYS = 14;
