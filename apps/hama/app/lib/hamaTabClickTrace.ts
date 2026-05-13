import type { HomeResultsNavParams } from "@/lib/homeResultsNavParams";
import { normalizeBrandQuery } from "@/lib/results/placeNameSearchIntent";

/**
 * 홈·퀵그리드 → /results 동일 계약 (recommend-v2·useHomeCards 명시 파라미터).
 */
export const HOME_RESULTS_TAB_TARGETS = {
  beauty: { q: "미용", category: "beauty", intent: "beauty_general" },
  fitness: { q: "운동", category: "fitness", intent: "fitness_general" },
  life: { q: "생활", category: "life", intent: "life_general" },
  cafe: { q: "카페", category: "cafe", intent: "cafe_general" },
  restaurant: { q: "식당", category: "restaurant", intent: "restaurant_general" },
  activity: { q: "나들이", category: "activity", intent: "activity_general" },
  /** 문화 타일 — category만으로도 results 시나리오가 문화 풀로 분기 */
  culture: { q: "박물관", category: "culture", intent: "activity_general" },
} as const;

export type HamaTabClickTracePayload = {
  source: string;
  key: string | null;
  label: string | null;
  href: string | null;
  nav: HomeResultsNavParams | null;
  nextUrl: string;
};

export function buildResultsSearchUrl(q: string, nav?: HomeResultsNavParams | null): string {
  const usp = new URLSearchParams();
  usp.set("q", q.trim());
  if (nav?.intent) usp.set("intent", nav.intent);
  if (nav?.category) usp.set("category", nav.category);
  if (nav?.mode) usp.set("mode", nav.mode);
  return `/results?${usp.toString()}`;
}

function normKey(s: string): string {
  return normalizeBrandQuery(s).trim();
}

function navFromTarget(target: (typeof HOME_RESULTS_TAB_TARGETS)[keyof typeof HOME_RESULTS_TAB_TARGETS]): HomeResultsNavParams {
  return { intent: target.intent, category: target.category };
}

/**
 * 홈 히어로 등에서 `category`/`intent` 없이 검색한 경우, 알려진 단일 토큰이면 /results 계약으로 승격.
 */
export function inferHomeSearchResultsNav(rawQuery: string): { q: string; nav: HomeResultsNavParams } | null {
  const n = normKey(rawQuery);
  if (!n) return null;

  const rows: { keys: string[]; pick: keyof typeof HOME_RESULTS_TAB_TARGETS }[] = [
    { keys: ["미용"], pick: "beauty" },
    { keys: ["운동"], pick: "fitness" },
    { keys: ["생활"], pick: "life" },
    { keys: ["카페"], pick: "cafe" },
    { keys: ["식당", "맛집", "푸드"], pick: "restaurant" },
    { keys: ["나들이", "액티비티"], pick: "activity" },
  ];

  for (const row of rows) {
    if (row.keys.some((k) => normKey(k) === n)) {
      const t = HOME_RESULTS_TAB_TARGETS[row.pick];
      return { q: t.q, nav: navFromTarget(t) };
    }
  }
  return null;
}

function navHasHints(nav?: HomeResultsNavParams | null): boolean {
  if (!nav) return false;
  return Boolean(nav.category || nav.intent || nav.mode);
}

/** 히어로(명시 nav 없음)·퀵그리드(명시 nav 있음) 공통 — 최종 /results URL */
export function resolveHomeResultsUrl(rawQuery: string, nav?: HomeResultsNavParams | null): string {
  const trimmed = rawQuery.trim();
  const inferred = !navHasHints(nav) ? inferHomeSearchResultsNav(trimmed) : null;
  const finalNav = navHasHints(nav) ? nav! : inferred?.nav;
  const finalQ = inferred?.q ?? trimmed;
  return buildResultsSearchUrl(finalQ, finalNav ?? null);
}

export const HOME_TABS = [
  {
    key: "beauty",
    label: "뷰티",
    query: HOME_RESULTS_TAB_TARGETS.beauty.q,
    nav: navFromTarget(HOME_RESULTS_TAB_TARGETS.beauty),
  },
  {
    key: "fitness",
    label: "운동",
    query: HOME_RESULTS_TAB_TARGETS.fitness.q,
    nav: navFromTarget(HOME_RESULTS_TAB_TARGETS.fitness),
  },
  {
    key: "life",
    label: "생활",
    query: HOME_RESULTS_TAB_TARGETS.life.q,
    nav: navFromTarget(HOME_RESULTS_TAB_TARGETS.life),
  },
] as const;

export function logHamaTabClickTrace(payload: HamaTabClickTracePayload): void {
  console.log("[HAMA_TAB_CLICK_TRACE]", payload);
}
