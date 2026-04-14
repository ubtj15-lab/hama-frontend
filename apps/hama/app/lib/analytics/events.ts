/**
 * 오픈베타 분석용 이벤트 이름 — logEvent(type, payload) 의 type 으로 사용.
 * props 는 page, place_id, scenario, rank, source 등 공통 키를 맞춘다.
 */
export const HamaEvents = {
  session_start: "session_start",
  page_view: "page_view",

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
