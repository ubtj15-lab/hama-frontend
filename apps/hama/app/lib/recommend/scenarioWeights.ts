// 시나리오별 태그·카테고리 가산 — DB 텍스트는 정규식으로 흡수
// meeting 의도는 group 과 동일

import type { IntentionType } from "@/lib/intention";

export type RecommendScenarioKey = "date" | "family" | "solo" | "group";

export type ScenarioTagRule = {
  id: string;
  weight: number;
  patterns: RegExp[];
};

/** 카테고리/업종 힌트 가산 (blob+category 문자열에 매칭) */
export type ScenarioCategoryBonusRule = {
  id: string;
  weight: number;
  patterns: RegExp[];
};

function sumWeights(rules: { weight: number }[]): number {
  return rules.reduce((s, r) => s + r.weight, 0);
}

export const DATE_TAG_RULES: ScenarioTagRule[] = [
  { id: "분위기좋음", weight: 30, patterns: [/분위기|로맨틱|감성|예쁜|인스타|감각적/] },
  { id: "조용함", weight: 20, patterns: [/조용|한적|프라이빗|은밀|잔잔/] },
  { id: "사진맛집", weight: 15, patterns: [/사진|포토|인생샷|포토존/] },
  { id: "디저트가능", weight: 12, patterns: [/디저트|베이커리|케이크|마카롱|티라미수/] },
  { id: "야간분위기", weight: 12, patterns: [/야경|야간|루프탑|나이트|캔들|조명/] },
  { id: "산책연계", weight: 10, patterns: [/산책|공원|호수|강변|둘레/] },
  { id: "와인가능", weight: 8, patterns: [/와인|페어링|바텐더/] },
  { id: "대화하기좋음", weight: 18, patterns: [/대화|담소|수다|데이트/] },
];

export const DATE_CATEGORY_BONUSES: ScenarioCategoryBonusRule[] = [
  { id: "restaurant", weight: 20, patterns: [/restaurant|식당|맛집|레스토랑|fd6/i] },
  { id: "cafe", weight: 16, patterns: [/cafe|카페|커피|브런치|ce7/i] },
  { id: "bar_wine", weight: 14, patterns: [/바\b|wine|와인바|pub|포차|이자카야|주점|술집/] },
  { id: "dessert", weight: 12, patterns: [/디저트|디저트카페|베이커리|케이크/] },
];

export const FAMILY_TAG_RULES: ScenarioTagRule[] = [
  {
    id: "아이동반가능",
    weight: 30,
    patterns: [/아이(?!스)|키즈|유아|어린이|아이동반|키즈룸/],
  },
  { id: "주차가능", weight: 20, patterns: [/주차|무료주차|발렛/] },
  { id: "좌석넓음", weight: 18, patterns: [/넓은|좌석|룸|가족석|테이블넓/] },
  {
    id: "메뉴다양함",
    weight: 15,
    patterns: [/메뉴.{0,10}다양|다양.{0,10}메뉴|뷔페|코스요리/],
  },
  { id: "웨이팅적음", weight: 12, patterns: [/웨이팅|대기.{0,3}적|바로입장/] },
  { id: "유아의자", weight: 12, patterns: [/유아의자|아기의자|아기식기/] },
  { id: "가족모임적합", weight: 18, patterns: [/가족|가족모임|가족단위/] },
  { id: "시끄러워도부담없음", weight: 10, patterns: [/시끌|활기|키즈환영|아이환영/] },
];

export const FAMILY_CATEGORY_BONUSES: ScenarioCategoryBonusRule[] = [
  { id: "restaurant", weight: 22, patterns: [/restaurant|식당|맛집|한식|양식|fd6/i] },
  { id: "cafe", weight: 8, patterns: [/cafe|카페|ce7/i] },
  { id: "foodcourt", weight: 12, patterns: [/푸드코트|food\s*court|코트/] },
  { id: "bakery", weight: 8, patterns: [/베이커리|bakery|빵집/] },
];

export const SOLO_TAG_RULES: ScenarioTagRule[] = [
  { id: "혼밥가능", weight: 30, patterns: [/혼밥|혼자|1인|나혼자/] },
  { id: "빠른식사", weight: 20, patterns: [/빠른|간단|백반|분식|도시락|스피드/] },
  { id: "부담없는가격", weight: 18, patterns: [/가성비|착한\s*가격|저렴|부담없/] },
  { id: "접근쉬움", weight: 15, patterns: [/역\s*앞|도보|접근|가까운|로컬/] },
  { id: "1인석", weight: 14, patterns: [/1인석|바좌석|카운터|싱글/] },
  { id: "회전빠름", weight: 12, patterns: [/회전|빨리|즉석/] },
  { id: "간단식사", weight: 10, patterns: [/간단|한\s*끼|가벼운/] },
];

export const SOLO_CATEGORY_BONUSES: ScenarioCategoryBonusRule[] = [
  { id: "restaurant", weight: 20, patterns: [/restaurant|식당|밥|fd6/i] },
  { id: "ramen_noodle", weight: 18, patterns: [/라멘|우동|국수|면요리|ramen|noodle/] },
  { id: "kimbap_snack", weight: 18, patterns: [/김밥|분식|떡볶이|한끼/] },
  { id: "cafe", weight: 8, patterns: [/cafe|카페|ce7/i] },
];

export const GROUP_TAG_RULES: ScenarioTagRule[] = [
  { id: "단체석", weight: 30, patterns: [/단체|단체석|대형\s*룸|다인석/] },
  { id: "예약가능", weight: 20, patterns: [/예약|단체예약/] },
  { id: "늦게까지영업", weight: 18, patterns: [/늦게|야간|새벽|24시|심야/] },
  { id: "가성비", weight: 15, patterns: [/가성비|인원|양많|푸짐/] },
  { id: "술가능", weight: 12, patterns: [/술|주류|맥주|소주|와인|포차/] },
  { id: "소음허용", weight: 10, patterns: [/소음|시끌|활기|단체환영/] },
  { id: "단체모임적합", weight: 18, patterns: [/회식|모임|단체모임|야유회/] },
];

export const GROUP_CATEGORY_BONUSES: ScenarioCategoryBonusRule[] = [
  { id: "restaurant", weight: 20, patterns: [/restaurant|식당|맛집|fd6/i] },
  { id: "meat", weight: 18, patterns: [/고기|삼겹|갈비|bbq|구이/] },
  { id: "pub", weight: 18, patterns: [/포차|포장마차|술집/] },
  { id: "bar", weight: 15, patterns: [/바\b|bar|이자카야|호프/] },
  { id: "cafe", weight: 6, patterns: [/cafe|카페|ce7/i] },
];

export const SCENARIO_TAG_RULES: Record<RecommendScenarioKey, ScenarioTagRule[]> = {
  date: DATE_TAG_RULES,
  family: FAMILY_TAG_RULES,
  solo: SOLO_TAG_RULES,
  group: GROUP_TAG_RULES,
};

const SCENARIO_CATEGORY_RULES: Record<RecommendScenarioKey, ScenarioCategoryBonusRule[]> = {
  date: DATE_CATEGORY_BONUSES,
  family: FAMILY_CATEGORY_BONUSES,
  solo: SOLO_CATEGORY_BONUSES,
  group: GROUP_CATEGORY_BONUSES,
};

/** 시나리오별 원점수 상한 (태그 전부 + 카테고리 가산 최댓값 1개) */
export const SCENARIO_RAW_CAP: Record<RecommendScenarioKey, number> = {
  date: sumWeights(DATE_TAG_RULES) + Math.max(...DATE_CATEGORY_BONUSES.map((b) => b.weight), 0),
  family: sumWeights(FAMILY_TAG_RULES) + Math.max(...FAMILY_CATEGORY_BONUSES.map((b) => b.weight), 0),
  solo: sumWeights(SOLO_TAG_RULES) + Math.max(...SOLO_CATEGORY_BONUSES.map((b) => b.weight), 0),
  group: sumWeights(GROUP_TAG_RULES) + Math.max(...GROUP_CATEGORY_BONUSES.map((b) => b.weight), 0),
};

export function intentionToScenarioKey(intent: IntentionType): RecommendScenarioKey | "neutral" {
  if (intent === "none") return "neutral";
  if (intent === "meeting") return "group";
  return intent;
}

export function scenarioCategoryBonusMax(blob: string, key: RecommendScenarioKey): number {
  const hay = blob.toLowerCase().replace(/\s+/g, " ");
  let max = 0;
  for (const b of SCENARIO_CATEGORY_RULES[key]) {
    if (b.patterns.some((re) => re.test(hay))) max = Math.max(max, b.weight);
  }
  return max;
}
