import type { ScenarioType } from "./types";

/** alias(소문자·공백 정규화 전 텍스트에 부분 일치) → 시나리오. 긴 구문을 먼저 매칭하도록 앞에 둠 */
export const SCENARIO_ALIAS_GROUPS: { scenario: ScenarioType; phrases: string[] }[] = [
  {
    scenario: "parent_child_outing",
    phrases: [
      "아이와 함께 나들이",
      "아이랑 나들이",
      "애 데리고 나들이",
      "키즈 나들이",
    ],
  },
  {
    scenario: "family_kids",
    phrases: [
      "아이랑 갈만한 곳",
      "아이랑 갈만한",
      "애 데리고 밥",
      "애 데리고 갈 곳",
      "유아 동반",
      "초등학생이랑",
      "아이랑 데이트",
      "키즈",
      "아이랑",
    ],
  },
  {
    scenario: "parents",
    phrases: ["부모님 모시고", "부모님과", "어른들이랑", "부모님이랑", "조용한 곳", "조용한곳"],
  },
  {
    scenario: "family",
    phrases: ["가족 외식", "가족 모임", "가족끼리", "가족이랑"],
  },
  {
    scenario: "group",
    phrases: ["회식", "단체", "여럿이", "여러 명", "여러명", "팀 모임", "단체로"],
  },
  {
    scenario: "friends",
    phrases: ["친구들이랑", "친구 모임", "친구랑", "친구들과", "둘이 가볍게"],
  },
  {
    scenario: "date",
    phrases: [
      "연인",
      "커플",
      "데이트",
      "분위기 좋은 곳",
      "분위기좋은",
      "소개팅",
    ],
  },
  { scenario: "solo", phrases: ["혼자 가기 좋은", "혼자 시간", "혼밥", "혼자", "1인"] },
];

export const COURSE_INTENT_MARKERS = [
  "코스",
  "일정",
  "루트",
  "플랜",
  "짜줘",
  "추천 코스",
  "코스 짜",
];
