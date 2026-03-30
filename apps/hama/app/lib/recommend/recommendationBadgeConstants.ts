import type { RecommendScenarioKey } from "./scenarioWeights";

/** 시나리오 → 카드 상단 단일 라벨 (UI) */
export const PRIMARY_LABEL_BY_SCENARIO: Record<RecommendScenarioKey, string> = {
  date: "데이트",
  family: "가족",
  solo: "혼밥",
  group: "회식",
};

/** 이후 "모임" 등 확장용 — 의도/AB 테스트에서 덮어쓸 수 있음 */
export const PRIMARY_LABEL_ALTERNATES: Partial<Record<RecommendScenarioKey, string>> = {
  // group: "모임",
};

/** intent·추론 모두 애매할 때 pill 문구 (카테고리형 추론 라벨 대신) */
export const GENERIC_PRIMARY_LABEL = "추천";

/**
 * neutral 추론만 쓸 때, 이 원점수 미만이면 primary는 GENERIC (가족 등 오탐 라벨 방지)
 */
export const BADGE_MIN_RAW_FOR_INFERRED_LABEL = 28;

/**
 * 시나리오 태그 rule id → 짧은 표시문 (scenarioWeights 의 id 와 동기화)
 */
export const TAG_ID_TO_DISPLAY: Record<string, string> = {
  // date
  분위기좋음: "분위기 좋음",
  조용함: "조용한 편",
  대화하기좋음: "대화하기 좋음",
  사진맛집: "사진 맛집",
  디저트가능: "디저트 가능",
  야간분위기: "야경 좋음",
  산책연계: "산책 연계",
  와인가능: "와인 가능",
  // family
  아이동반가능: "아이 동반",
  주차가능: "주차 가능",
  좌석넓음: "좌석 넓음",
  메뉴다양함: "메뉴 다양",
  웨이팅적음: "웨이팅 적음",
  유아의자: "유아의자",
  가족모임적합: "가족 모임",
  시끄러워도부담없음: "키즈 환영",
  // solo
  혼밥가능: "혼밥 가능",
  빠른식사: "빠른 식사",
  부담없는가격: "부담 적음",
  접근쉬움: "접근 편함",
  "1인석": "1인석",
  회전빠름: "빨리 나옴",
  간단식사: "가볍게 식사",
  // group
  단체석: "단체석",
  예약가능: "예약 가능",
  늦게까지영업: "늦게까지 영업",
  가성비: "가성비",
  술가능: "술 가능",
  단체모임적합: "단체 모임",
  소음허용: "편하게 대화",
};

/** rule id 밖에서 blob 으로 잡는 보강 태그 */
export type ScenarioExtraTagDef = {
  scenario: RecommendScenarioKey;
  weight: number;
  patterns: RegExp[];
  /** 이미 UI 친화 표기 */
  label: string;
};

export const SCENARIO_EXTRA_TAGS: ScenarioExtraTagDef[] = [
  { scenario: "date", weight: 26, patterns: [/루프탑|rooftop/i], label: "루프탑" },
  { scenario: "family", weight: 22, patterns: [/키즈존|키즈\s*룸/i], label: "키즈존" },
  { scenario: "group", weight: 20, patterns: [/룸\b|별실|개별룸|단독룸/i], label: "룸 있음" },
];
