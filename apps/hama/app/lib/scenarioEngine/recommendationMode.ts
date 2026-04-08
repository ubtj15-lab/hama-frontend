import type { RecommendationMode } from "./types";
import { isCourseGenerationQuery } from "./courseTriggerPatterns";
import { normIntentQuery } from "./intentQueryNormalize";

/**
 * 단일 장소 추천이 명확할 때 (시간 흐름·코스 의도보다 우선).
 */
const SINGLE_STRONG_RULES: RegExp[] = [
  /혼밥/,
  /(?:점심|저녁|아침|브런치|야식)\s*(?:뭐\s*먹|뭐먹|먹지|메추|점메추|저메추|추천|\?)/,
  /뭐\s*먹을*/,
  /(?:뭐|무엇)\s*(?:먹지|먹을|먹을까)/,
  // 음식점·놀거리 등 "한 곳" 탐색
  /(?:중국집|짜장|짬뽕|탕수육|초밥|회|국밥|순대|칼국수|파스타|스테이크|햄버거|이탈리안|베트남|태국)\s*(?:추천|맛집|어디)/,
  /(?:추천|맛집)\s*(?:중국집|짜장|짬뽕|초밥|국밥)/,
  /(?:식당|맛집|카페|커피|미용실|헤어|네일|놀거리|액티비티)\s*추천/,
  // 부모님 + 식사 맥락 (나들이 없을 때 식사 위주)
  /부모님[^\n]{0,16}(?:식사|맛집|밥|저녁|점심)(?![^\n]{0,12}나들이)/,
  /(?:어머님|아버님|부모)\s*(?:모시고|데리고)\s*(?:식사|밥|맛집)/,
];

/**
 * "시간 흐름"·동선·플랜이 있으면 코스 모드.
 * (기존 course_generation 트리거와 합침)
 */
function matchesCourseFlowSignals(n: string): boolean {
  if (isCourseGenerationQuery(n)) return true;

  const flowPatterns: RegExp[] = [
    /나들이/,
    /반나절/,
    /하루\s*(?:종일|계획|일정|코스)?/,
    /(?:오전|오후|종일)\s*(?:일정|코스|계획)/,
    /일정\s*(?:짜|세우|잡아|추천)/,
    /(?:데이트|가족|키즈|아이랑|애\s*데리고)\s*코스/,
    /코스\s*(?:짜|이어|구성|만들|추천|잡아)/,
    // 트립·동선
    /(?:동선|루트|플랜|플래?랜)/,
    /순서\s*(?:대로|짜)/,
  ];

  return flowPatterns.some((re) => re.test(n));
}

function matchesSingleStrong(n: string): boolean {
  return SINGLE_STRONG_RULES.some((re) => re.test(n));
}

/**
 * URL 쿼리 기준 추천 표현 방식.
 * — 시간·동선·일정이 강하면 course, 아니면 single.
 */
export function inferRecommendationMode(rawQuery: string): RecommendationMode {
  const n = normIntentQuery(rawQuery);
  if (!n) return "single";
  if (matchesSingleStrong(n)) return "single";
  if (matchesCourseFlowSignals(n)) return "course";
  return "single";
}
