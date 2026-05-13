import type { HomeTabKey } from "@/lib/storeTypes";
import { normalizeResultsExplicitCategory } from "@/lib/hamaResultCategoryCanonical";

/**
 * 홈 퀵 카테고리 → /results 네비게이션에 붙이는 명시 파라미터.
 * 추천 알고리즘은 기존 `q` + scenario 파싱을 유지하고, 후보 풀 fetch 등에 힌트로만 사용합니다.
 */
export type HomeResultsNavParams = {
  intent?: string;
  category?: string;
  mode?: string;
};

/** URL `category` 값 → `fetchHomeCardsByTab` 탭 (명시 힌트용) */
export function explicitCategoryToFetchTab(category: string | null | undefined): HomeTabKey | null {
  const c = normalizeResultsExplicitCategory(category) ?? (category ?? "").trim().toLowerCase();
  if (!c) return null;
  switch (c) {
    case "restaurant":
      return "restaurant";
    case "cafe":
      return "cafe";
    /** DB는 `salon` / `bk9` / `beauty` 등 — Supabase `stores.category` 컬럼과 맞춤 */
    case "beauty":
      return "salon";
    case "activity":
      return "activity";
    case "culture":
      return "museum";
    case "fitness":
      return "fitness";
    case "life":
      return "life";
    case "mixed":
      return "all";
    default:
      return null;
  }
}
