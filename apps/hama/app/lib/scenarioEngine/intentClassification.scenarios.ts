import {
  classifyIntent,
  detectStrictCategory,
  parseScenarioIntent,
} from "./intentClassification";

type Case = { q: string; expect: Record<string, unknown> };

function ok(name: string, cond: boolean, detail: string): string | null {
  return cond ? null : `${name}: ${detail}`;
}

function matchExpect(got: unknown, v: unknown): boolean {
  if (Array.isArray(v)) {
    if (!Array.isArray(got)) return false;
    if (got.length !== v.length) return false;
    const a = [...(got as unknown[])].map(String).sort();
    const b = [...v].map(String).sort();
    return a.every((x, i) => x === b[i]);
  }
  return got === v;
}

/**
 * 의도 분기 테스트 — 실패 메시지 배열(비어 있으면 통과).
 */
export function runIntentClassificationChecks(): string[] {
  const failures: string[] = [];

  const cases: Case[] = [
    { q: "점심 뭐 먹지", expect: { intentType: "search_strict", intentCategory: "FOOD", recommendationMode: "single" } },
    { q: "카페 추천", expect: { intentType: "search_strict", intentCategory: "CAFE" } },
    { q: "미용실 추천", expect: { intentType: "search_strict", intentCategory: "BEAUTY" } },
    { q: "놀거리 추천", expect: { intentType: "search_strict", intentCategory: "ACTIVITY" } },
    {
      q: "데이트 맛집",
      expect: { intentType: "search_strict", intentCategory: "FOOD", scenario: "date" },
    },
    {
      q: "아이랑 밥 먹기 좋은 곳",
      expect: { intentType: "search_strict", intentCategory: "FOOD", scenario: "family_kids" },
    },
    {
      q: "부모님 모시고 점심",
      expect: { intentType: "search_strict", intentCategory: "FOOD", scenario: "parents" },
    },
    {
      q: "조용한 카페 추천",
      expect: { intentType: "search_strict", intentCategory: "CAFE" },
    },
    {
      q: "혼자 가기 좋은 곳",
      expect: { intentType: "scenario_recommendation", scenario: "solo" },
    },
    {
      q: "부모님 모시고 식사",
      expect: { intentType: "search_strict", intentCategory: "FOOD", scenario: "parents" },
    },
    {
      q: "점심 추천",
      expect: { intentType: "search_strict", intentCategory: "FOOD" },
    },
    {
      q: "아이랑 갈만한 곳",
      expect: { intentType: "scenario_recommendation", scenario: "family_kids" },
    },
    {
      q: "데이트 코스 짜줘",
      expect: { intentType: "course_generation", scenario: "date", recommendationMode: "course" },
    },
    {
      q: "비 오는 날 실내 데이트 코스",
      expect: {
        intentType: "course_generation",
        indoorPreferred: true,
        weatherHint: "rain",
      },
    },
    {
      q: "중국음식 추천",
      expect: {
        intentType: "search_strict",
        intentCategory: "FOOD",
        foodSubCategory: "CHINESE",
      },
    },
    {
      q: "짜장면 먹고 싶어",
      expect: {
        intentType: "search_strict",
        intentCategory: "FOOD",
        foodSubCategory: "CHINESE",
        menuIntent: ["짜장면"],
      },
    },
    {
      q: "짬뽕 맛집",
      expect: {
        intentType: "search_strict",
        intentCategory: "FOOD",
        foodSubCategory: "CHINESE",
        menuIntent: ["짬뽕"],
      },
    },
    {
      q: "탕수육 되는 곳",
      expect: {
        intentType: "search_strict",
        intentCategory: "FOOD",
        foodSubCategory: "CHINESE",
        menuIntent: ["탕수육"],
      },
    },
    {
      q: "초밥 추천",
      expect: {
        intentType: "search_strict",
        intentCategory: "FOOD",
        foodSubCategory: "JAPANESE",
        menuIntent: ["초밥"],
      },
    },
    {
      q: "돈까스 먹고 싶다",
      expect: {
        intentType: "search_strict",
        intentCategory: "FOOD",
        foodSubCategory: "JAPANESE",
        menuIntent: ["돈까스"],
      },
    },
    {
      q: "국밥집 알려줘",
      expect: {
        intentType: "search_strict",
        intentCategory: "FOOD",
        foodSubCategory: "KOREAN",
        menuIntent: ["국밥"],
      },
    },
    {
      q: "아이랑 돈까스 먹을만한 곳",
      expect: {
        intentType: "search_strict",
        intentCategory: "FOOD",
        scenario: "family_kids",
        foodSubCategory: "JAPANESE",
        menuIntent: ["돈까스"],
      },
    },
    {
      q: "부모님 모시고 국밥",
      expect: {
        intentType: "search_strict",
        intentCategory: "FOOD",
        scenario: "parents",
        foodSubCategory: "KOREAN",
        menuIntent: ["국밥"],
      },
    },
    { q: "중국집 추천", expect: { recommendationMode: "single", intentType: "search_strict" } },
    { q: "혼밥 추천", expect: { recommendationMode: "single" } },
    { q: "아이랑 나들이", expect: { recommendationMode: "course", intentType: "course_generation" } },
  ];

  for (const { q, expect: exp } of cases) {
    const p = parseScenarioIntent(q);
    const label = JSON.stringify(q);
    for (const [k, v] of Object.entries(exp)) {
      const got = (p as any)[k];
      failures.push(
        ...[
          ok(
            `${label}.${k}`,
            matchExpect(got, v),
            `expected ${JSON.stringify(v)}, got ${JSON.stringify(got)}`
          ),
        ].filter(Boolean) as string[]
      );
    }
  }

  failures.push(
    ...[
      ok("classify 점심", classifyIntent("점심 뭐 먹지") === "search_strict", "search_strict"),
      ok("strict 없음", detectStrictCategory("아이랑 갈만한 곳") === null, "null"),
    ].filter(Boolean) as string[]
  );

  return failures;
}
