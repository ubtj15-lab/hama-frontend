import { normalizeResultsExplicitCategory } from "@/lib/hamaResultCategoryCanonical";

/** `results/page.tsx`의 `beautyUrlFinalGuard`와 동일한 “뷰티 URL” 판별 */
export function isBeautyUrlFromExplicitNav(
  explicitCategory: string | null | undefined,
  explicitIntent: string | null | undefined
): boolean {
  const canon = normalizeResultsExplicitCategory(explicitCategory);
  const int = (explicitIntent ?? "").trim().toLowerCase();
  return canon === "beauty" || int.startsWith("beauty");
}

export type BeautyV2HardModeInput = {
  explicitCategory: string | null | undefined;
  explicitIntent: string | null | undefined;
  recommendEngine: "v1" | "v2" | null | undefined;
  useRecommendV2Flag: boolean;
};

/**
 * 뷰티 결과에서 v1 stable/recovery 덱을 쓰지 않는 하드 모드.
 * - 뷰티 URL이고 `recommendEngine === "v2"`이면 플래그와 무관하게 true.
 * - 그 외에는 기존처럼 `useRecommendV2Flag`가 켜진 뷰티 URL이면 true.
 */
export function isBeautyV2HardMode(args: BeautyV2HardModeInput): boolean {
  const beautyUrl = isBeautyUrlFromExplicitNav(args.explicitCategory, args.explicitIntent);
  if (!beautyUrl) return false;
  if (args.recommendEngine === "v2") return true;
  return args.useRecommendV2Flag;
}
