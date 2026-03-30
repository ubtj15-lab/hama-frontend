/**
 * parseSearchIntent 시나리오 검증 (개발·CI에서 호출)
 * npm 없이 브라우저 콘솔: import 후 runSearchIntentScenarioChecks()
 */

import { parseSearchIntent, type ParsedSearchIntent } from "./searchIntent";

export type ScenarioCase = {
  query: string;
  /** 최소 포함해야 할 축 (키가 있으면 해당 배열 비어 있으면 실패로 간주하지 않음 — 값은 부분 검사) */
  expect?: Partial<{
    companions: string[];
    categories: string[];
    moodHintsMin: number;
    conditions: string[];
    areaTerms: string[];
    phraseIncludes: string;
  }>;
};

export const SEARCH_INTENT_SCENARIOS: ScenarioCase[] = [
  { query: "아이랑 같이", expect: { companions: ["kids"] } },
  { query: "애기랑 갈 곳", expect: { companions: ["kids"] } },
  { query: "가족이랑 식당", expect: { companions: ["family"], categories: ["restaurant"] } },
  { query: "데이트하기 좋은 식당", expect: { companions: ["date"], categories: ["restaurant"] } },
  { query: "분위기 좋은 카페", expect: { categories: ["cafe"], moodHintsMin: 1 } },
  { query: "조용한 카페", expect: { categories: ["cafe"], moodHintsMin: 1 } },
  { query: "회식하기 좋은 곳", expect: { companions: ["company"] } },
  { query: "혼자 가기 좋은 밥집", expect: { companions: ["solo"], categories: ["restaurant"] } },
  { query: "주차되는 식당", expect: { categories: ["restaurant"], conditions: ["parking"] } },
  { query: "실내 액티비티", expect: { categories: ["activity"], conditions: ["indoor"] } },
  { query: "동탄 데이트 코스", expect: { areaTerms: ["동탄"], companions: ["date"] } },
  { query: "오산 아이랑 갈만한 곳", expect: { areaTerms: ["오산"], companions: ["kids"] } },
  { query: "근처 카페 추천", expect: { categories: ["cafe"], conditions: ["nearby"] } },
  { query: "가성비 좋은 점심", expect: { conditions: ["value"] } },
  { query: "카페", expect: { categories: ["cafe"] } },
  { query: "미용실 추천", expect: { categories: ["salon"] } },
  { query: "키즈카페", expect: { categories: ["activity", "cafe"] } },
  { query: "로맨틱한 저녁 식당", expect: { companions: ["date"], categories: ["restaurant"] } },
  { query: "단체 회식 장소", expect: { companions: ["company"] } },
  { query: "혼밥 맛집", expect: { companions: ["solo"], categories: ["restaurant"] } },
  { query: "수원 데이트", expect: { areaTerms: ["수원"], companions: ["date"] } },
  { query: "감성 카페", expect: { categories: ["cafe"], moodHintsMin: 1 } },
  { query: "두부마을", expect: { categories: ["restaurant"] } },
  { query: "순두부찌개 맛집", expect: { categories: ["restaurant"] } },
  { query: "주차 가능한 맛집", expect: { conditions: ["parking"], categories: ["restaurant"] } },
];

function checkExpect(parsed: ParsedSearchIntent, ex: ScenarioCase["expect"]): string[] {
  if (!ex) return [];
  const errs: string[] = [];
  for (const c of ex.companions ?? []) {
    if (!parsed.companions.includes(c as any)) errs.push(`missing companion:${c}`);
  }
  for (const c of ex.categories ?? []) {
    if (!parsed.categories.includes(c as any)) errs.push(`missing category:${c}`);
  }
  for (const c of ex.conditions ?? []) {
    if (!parsed.conditions.includes(c as any)) errs.push(`missing condition:${c}`);
  }
  for (const a of ex.areaTerms ?? []) {
    if (!parsed.areaTerms.includes(a)) errs.push(`missing area:${a}`);
  }
  if (ex.moodHintsMin != null && parsed.moodHints.length < ex.moodHintsMin) {
    errs.push(`moodHints ${parsed.moodHints.length} < ${ex.moodHintsMin}`);
  }
  if (ex.phraseIncludes && !(parsed.phraseMatched ?? "").includes(ex.phraseIncludes)) {
    errs.push(`phraseMatched missing "${ex.phraseIncludes}" got "${parsed.phraseMatched}"`);
  }
  return errs;
}

export function runSearchIntentScenarioChecks(): {
  passed: number;
  failed: number;
  failures: { query: string; errors: string[] }[];
} {
  const failures: { query: string; errors: string[] }[] = [];
  for (const sc of SEARCH_INTENT_SCENARIOS) {
    const p = parseSearchIntent(sc.query);
    const errors = checkExpect(p, sc.expect);
    if (errors.length) failures.push({ query: sc.query, errors });
  }
  return {
    passed: SEARCH_INTENT_SCENARIOS.length - failures.length,
    failed: failures.length,
    failures,
  };
}
