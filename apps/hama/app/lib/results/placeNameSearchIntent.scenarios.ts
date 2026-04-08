import { shouldRunPlaceNameSearchFirst } from "./placeNameSearchIntent";

function ok(name: string, cond: boolean, detail: string): string | null {
  return cond ? null : `${name}: ${detail}`;
}

/** 매장명 우선 검색 분기 테스트 — 실패 메시지 배열(빈 배열이면 통과). */
export function runPlaceNameSearchIntentChecks(): string[] {
  const failures: string[] = [];

  const fixed: { q: string; expectBrandSearch: boolean }[] = [
    { q: "두부마을", expectBrandSearch: true },
    { q: "스타벅스", expectBrandSearch: true },
    { q: "홍콩반점", expectBrandSearch: true },
    { q: "점심 뭐 먹지", expectBrandSearch: false },
    { q: "데이트 코스", expectBrandSearch: false },
    { q: "혼밥 추천", expectBrandSearch: false },
    { q: "Starbucks", expectBrandSearch: true },
    { q: "㈜두부마을", expectBrandSearch: true },
    { q: "맥도날드 오산DT점", expectBrandSearch: true },
    { q: "맛집 추천", expectBrandSearch: false },
  ];

  for (const { q, expectBrandSearch } of fixed) {
    const got = shouldRunPlaceNameSearchFirst(q);
    failures.push(
      ...[
        ok(
          JSON.stringify(q),
          got === expectBrandSearch,
          `expected ${expectBrandSearch}, got ${got}`
        ),
      ].filter(Boolean) as string[]
    );
  }

  return failures;
}
