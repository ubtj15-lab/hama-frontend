import type { HomeCard } from "@/lib/storeTypes";
import type { PlaceType, ScenarioType } from "@/lib/scenarioEngine/types";

/**
 * 시나리오별 룰 기반 raw 보정 — scenario 점수 축에 합산(캡 전).
 * 아이동반 ‘태그만’으로 가산하지 않음(명시 가족·키즈·메뉴·시설 신호 위주).
 */
export function computeScenarioForcedRawDelta(scenario: ScenarioType | undefined, blob: string): number {
  if (!scenario) return 0;
  let d = 0;

  if (scenario === "family_kids" || scenario === "parent_child_outing" || scenario === "family") {
    if (
      /돈까스|돈가스|파스타|한식|브런치|키즈카페|키즈\s*카페|실내\s*키즈|공원|실내\s*액티|키즈존|유아\s*의자|놀이방|가족\s*식당|가족\s*외식/.test(blob)
    ) {
      d += 20;
    }
    if (/주차|발렛|좌석\s*넓|넓은\s*좌석|테이블\s*간격|맵지\s*않|안\s*맵|순한\s*맛|아이\s*메뉴|대기\s*적|웨이팅\s*적|바로\s*입장/.test(blob)) {
      d += 16;
    }
    if (/횟집|장어|술집|포차|회식|야유회|포장마차\s*회식|매운\s*전문|맵기\s*자랑|불닭|매운맛|2인\s*이상|단체\s*코스|좌석\s*좁|좁은\s*좌석/.test(blob)) {
      d -= 44;
    }
    if (/(?:^|\s)bar(?:$|\s)|이자카야|주점/.test(blob)) d -= 30;
  }

  if (scenario === "date" || scenario === "parents") {
    d += dateMoodFlowFitDelta(blob);
    if (/아이\s*동반|키즈존|가족\s*외식|회식\s*형|푸드코트|food\s*court|시끄|북적|빠른\s*회전|회전\s*빠름/.test(blob)) d -= 28;
  }

  if (scenario === "solo") {
    if (
      /1인\s*메뉴|혼밥|빠른\s*식사|가성비|국밥|덮밥|라멘|분식|버거|햄버거|바\s*좌석|바좌석|카운터|캐주얼/.test(blob)
    ) {
      d += 20;
    }
    if (/가족\s*외식|회식\s*형|2인\s*이상|예약\s*필수|코스\s*요리|단체\s*전문|가족\s*단위/.test(blob)) d -= 26;
    if (/drink\s*only|음료\s*전문|테이크아웃\s*전문/.test(blob)) d -= 18;
  }

  return d;
}

/** 데이트: moodFit + flowFit 근사 raw 가산 */
export function dateMoodFlowFitDelta(blob: string): number {
  let s = 0;
  if (/조용|감성|야경|대화|테이블\s*간격|프라이빗|루프탑|뷰|디저트|브런치|산책|산책로|산책\s*연|로맨틱|분위기/.test(blob)) s += 24;
    if (/카페|와인/.test(blob)) s += 4;
  return s;
}

/**
 * 코스 템플릿 단계 흐름 — 시나리오별 선호 동선 가산.
 */
export function scenarioCourseFlowBias(steps: PlaceType[], scenario: ScenarioType): number {
  if (steps.length < 2) return 0;
  let bonus = 0;
  const [a, b, c] = [steps[0], steps[1], steps[2]];

  if (scenario === "date" || scenario === "parents") {
    if (a === "FOOD" && b === "CAFE" && (c === "WALK" || c === "ACTIVITY" || c === "CULTURE")) bonus += 15;
    else if (a === "FOOD" && (b === "WALK" || b === "ACTIVITY")) bonus += 10;
    else if (a === "CAFE" && (b === "ACTIVITY" || b === "CULTURE" || b === "WALK")) bonus += 8;
    if (steps.includes("FOOD") && steps.includes("CAFE") && (steps.includes("WALK") || steps.includes("ACTIVITY")))
      bonus += 4;
  }

  if (scenario === "family_kids" || scenario === "parent_child_outing" || scenario === "family") {
    if (a === "FOOD" && b === "ACTIVITY") bonus += 14;
    if (a === "FOOD" && b === "ACTIVITY" && c === "CAFE") bonus += 16;
    if (a === "FOOD" && b === "CAFE" && c === "ACTIVITY") bonus += 10;
  }

  if (scenario === "solo") {
    if (a === "FOOD" && (b === "CAFE" || b === "WALK")) bonus += 12;
    if (steps.length >= 4) bonus -= 8;
  }

  return bonus;
}

export function convenienceScoreFromParts(bizS: number, bonS: number, kwS: number): number {
  return Math.min(100, Math.round(bizS * 0.48 + bonS * 0.35 + kwS * 0.17));
}
