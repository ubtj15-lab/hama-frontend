import type { HomeCard } from "@/lib/storeTypes";
import type { PlaceType, ScenarioType } from "@/lib/scenarioEngine/types";

/**
 * 시나리오별 룰 기반 raw 보정 — scenario 점수 축에 합산(캡 전).
 * family_kids 등은 하드 제외는 childFriendly 쪽과 병행.
 */
export function computeScenarioForcedRawDelta(scenario: ScenarioType | undefined, blob: string): number {
  if (!scenario) return 0;
  let d = 0;

  if (scenario === "family_kids" || scenario === "parent_child_outing" || scenario === "family") {
    if (/아이\s*동반|키즈|가족\s*외식|가족\s*식당|주차|발렛|좌석\s*넓|넓은\s*좌석|실내|놀이|키즈존|유아/.test(blob)) d += 22;
    if (/횟집|장어|술집|회식|야유회|포장마차\s*회식|매운\s*전문|맵기\s*자랑|불닭|매운맛/.test(blob)) d -= 38;
    if (/(?:^|\s)bar(?:$|\s)|이자카야|주점|포차/.test(blob)) d -= 28;
  }

  if (scenario === "date" || scenario === "parents") {
    if (/분위기|조용|감성|브런치|카페|산책|야경|루프탑|로맨틱|뷰|프라이빗/.test(blob)) d += 20;
    if (/아이\s*동반|키즈존|가족\s*외식|가족\s*단위/.test(blob)) d -= 26;
  }

  if (scenario === "solo") {
    if (/혼밥|혼자|1인|빠른|가성비|런치|간단\s*식사/.test(blob)) d += 18;
    if (/가족\s*외식|회식\s*전문|단체|2인\s*이상|코스\s*요리\s*전문/.test(blob)) d -= 24;
  }

  return d;
}

/**
 * 코스 템플릿 단계 흐름 — 시나리오별 선호 동선 가산(소액).
 */
export function scenarioCourseFlowBias(steps: PlaceType[], scenario: ScenarioType): number {
  if (steps.length < 2) return 0;
  let bonus = 0;
  const [a, b, c] = [steps[0], steps[1], steps[2]];

  if (scenario === "date" || scenario === "parents") {
    if (a === "FOOD" && b === "CAFE" && (c === "WALK" || c === "ACTIVITY")) bonus += 14;
    else if (a === "FOOD" && b === "CAFE") bonus += 9;
    else if (a === "FOOD" && (b === "WALK" || b === "ACTIVITY")) bonus += 6;
  }

  if (scenario === "family_kids" || scenario === "parent_child_outing" || scenario === "family") {
    if (a === "FOOD" && b === "ACTIVITY") bonus += 12;
    if (a === "FOOD" && b === "ACTIVITY" && c === "CAFE") bonus += 15;
    if (a === "FOOD" && b === "CAFE" && c === "ACTIVITY") bonus += 10;
  }

  if (scenario === "solo") {
    if (a === "FOOD" && (b === "CAFE" || b === "WALK")) bonus += 11;
  }

  return bonus;
}

export function convenienceScoreFromParts(bizS: number, bonS: number, kwS: number): number {
  return Math.min(100, Math.round(bizS * 0.48 + bonS * 0.35 + kwS * 0.17));
}
