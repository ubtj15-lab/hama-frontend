/**
 * 오픈베타 분석용 이벤트 이름 — logEvent(type, payload) 의 type 으로 사용.
 *
 * 공통 props 권장:
 * - page: "home" | "results" | "place_detail" | ...
 * - place_id, card_rank, query, scenario_key, source, surface
 */
export const HamaEvents = {
  session_start: "session_start",
  page_view: "page_view",
  /** 홈 첫 진입(세션 단위로 한 번만 쓰고 싶으면 클라이언트에서 가드) */
  home_enter: "home_enter",

  /** 홈 상황 입력창에서 제출 */
  home_scenario_submit: "home_scenario_submit",
  /** 빠른 시나리오 칩 */
  home_quick_scenario: "home_quick_scenario",
  /** 홈 추천 3칸 노출(매장 id 목록) */
  home_recommend_impression: "home_recommend_impression",
  /** 홈 추천 카드(또는 시나리오 행) 클릭 */
  home_recommend_row_click: "home_recommend_row_click",
  home_trust_directions: "home_trust_directions",
  home_trust_reserve: "home_trust_reserve",
  voice_mic_click: "voice_mic_click",

  /** 결과 화면 — 추천 3장(또는 그 이하) 노출. payload: place_ids[], recommendation_voices[] */
  recommend_deck_impression: "recommend_deck_impression",
  /** 추천 후보 풀은 있으나 덱이 비었을 때 */
  recommend_empty: "recommend_empty",

  /** 상세 진입 */
  place_detail_view: "place_detail_view",
  cta_directions: "cta_directions",
  cta_call: "cta_call",
  cta_save_toggle: "cta_save_toggle",
  external_place_open: "external_place_open",

  login_start: "login_start",
  logout: "logout",
  nearby_intent: "nearby_intent",
} as const;

export type HamaEventName = (typeof HamaEvents)[keyof typeof HamaEvents];
