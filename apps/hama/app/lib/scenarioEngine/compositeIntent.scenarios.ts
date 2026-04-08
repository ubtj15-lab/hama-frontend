import { parseScenarioIntent } from "./intentClassification";

function ok(name: string, cond: boolean, detail: string): string | null {
  return cond ? null : `${name}: ${detail}`;
}

function hasAll(got: unknown, need: unknown[]): boolean {
  if (!Array.isArray(got)) return false;
  const set = new Set((got as string[]).map(String));
  return need.every((n) => set.has(String(n)));
}

/**
 * 복합 의도 스팟 테스트 — 빈 배열이면 통과.
 */
export function runCompositeIntentChecks(): string[] {
  const failures: string[] = [];

  const cases: {
    q: string;
    check: (p: ReturnType<typeof parseScenarioIntent>) => (string | null)[];
  }[] = [
    {
      q: "아이랑 점심 먹기 좋은 중국집",
      check: (p) => [
        ok("아이점심중국", p.scenario === "family_kids", "scenario family_kids"),
        ok("아이점심중국", p.intentCategory === "FOOD", "FOOD"),
        ok("아이점심중국", p.foodSubCategory === "CHINESE", "CHINESE"),
        ok(
          "아이점심중국",
          p.timeOfDay === "lunch",
          `timeOfDay lunch got ${p.timeOfDay}`
        ),
        ok(
          "아이점심중국",
          hasAll(p.foodPreference, ["kid_friendly_menu", "light"]),
          `foodPreference ${JSON.stringify(p.foodPreference)}`
        ),
      ],
    },
    {
      q: "부모님 모시고 조용한 국밥집",
      check: (p) => [
        ok("부모국밥", p.scenario === "parents", "parents"),
        ok("부모국밥", p.intentCategory === "FOOD", "FOOD"),
        ok("부모국밥", p.foodSubCategory === "KOREAN", "KOREAN"),
        ok(
          "부모국밥",
          hasAll(p.menuIntent, ["국밥"]),
          `menu ${JSON.stringify(p.menuIntent)}`
        ),
        ok(
          "부모국밥",
          hasAll(p.vibePreference, ["calm"]),
          `vibe ${JSON.stringify(p.vibePreference)}`
        ),
        ok(
          "부모국밥",
          hasAll(p.foodPreference, ["parent_friendly_menu"]),
          `foodPref ${JSON.stringify(p.foodPreference)}`
        ),
      ],
    },
    {
      q: "데이트하기 좋은 분위기 있는 파스타집",
      check: (p) => [
        ok("데이트파스타", p.scenario === "date", "date"),
        ok("데이트파스타", p.foodSubCategory === "WESTERN", "WESTERN"),
        ok(
          "데이트파스타",
          hasAll(p.menuIntent, ["파스타"]),
          `menu ${JSON.stringify(p.menuIntent)}`
        ),
        ok(
          "데이트파스타",
          Boolean(p.vibePreference?.includes("atmospheric")),
          `vibe ${JSON.stringify(p.vibePreference)}`
        ),
      ],
    },
    {
      q: "비 오는 날 실내에서 가볍게 먹을 곳",
      check: (p) => [
        ok("비실내", p.weatherHint === "rain", "rain"),
        ok("비실내", p.indoorPreferred === true, "indoorPreferred"),
        ok(
          "비실내",
          hasAll(p.foodPreference, ["light"]),
          `foodPref ${JSON.stringify(p.foodPreference)}`
        ),
        ok(
          "비실내",
          Boolean(p.hardConstraints?.includes("indoor")),
          `hard ${JSON.stringify(p.hardConstraints)}`
        ),
        ok(
          "비실내",
          Boolean(p.softConstraints?.includes("rainy_day_food")),
          `soft ${JSON.stringify(p.softConstraints)}`
        ),
      ],
    },
    {
      q: "혼자 가볍게 먹기 좋은 국물 있는 곳",
      check: (p) => [
        ok("혼국물", p.scenario === "solo", "solo"),
        ok(
          "혼국물",
          Boolean(p.foodPreference?.includes("brothy") && p.foodPreference?.includes("light")),
          `foodPref ${JSON.stringify(p.foodPreference)}`
        ),
      ],
    },
    {
      q: "분위기 좋은 조용한 카페",
      check: (p) => [
        ok("카페분위기", p.intentCategory === "CAFE", "CAFE"),
        ok(
          "카페분위기",
          Boolean(
            p.vibePreference?.includes("atmospheric") && p.vibePreference?.includes("calm")
          ),
          `vibe ${JSON.stringify(p.vibePreference)}`
        ),
      ],
    },
  ];

  for (const { q, check } of cases) {
    const p = parseScenarioIntent(q);
    for (const line of check(p)) {
      if (line) failures.push(`${JSON.stringify(q)} → ${line}`);
    }
  }

  return failures;
}
