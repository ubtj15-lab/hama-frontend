import { normalizeResultsExplicitCategory } from "@/lib/hamaResultCategoryCanonical";

export type RecommendVertical = "beauty" | "fitness" | "life" | "cafe" | "restaurant" | "activity" | "all";

export type NormalizedRecommendRequest = {
  query: string;
  canonicalCategory: string | null;
  canonicalIntent: string | null;
  vertical: RecommendVertical;
};

function verticalFromCanonical(
  canonical: ReturnType<typeof normalizeResultsExplicitCategory>,
  rawCat: string,
  rawIntent: string
): RecommendVertical {
  if (canonical === "beauty" || rawCat === "salon" || rawCat === "hair") return "beauty";
  if (canonical === "fitness" || rawCat === "exercise" || rawCat === "workout" || rawCat === "gym") {
    return "fitness";
  }
  if (canonical === "life" || rawCat === "living" || rawCat === "convenience") return "life";
  if (canonical === "cafe") return "cafe";
  if (canonical === "restaurant" || rawCat === "food") return "restaurant";
  if (canonical === "culture" || canonical === "activity") return "activity";
  if (canonical === "mixed") return "all";

  const bag = `${rawCat} ${rawIntent}`;
  if (/(^|_)beauty|beauty_|salon|hair_|_hair/.test(bag)) return "beauty";
  if (/fitness|exercise|workout|\bgym\b/.test(bag)) return "fitness";
  if (/life_|living|convenience/.test(bag)) return "life";
  if (/\bcafe\b|cafe_|_cafe/.test(bag)) return "cafe";
  if (/restaurant|food_general|\bfood\b/.test(bag)) return "restaurant";
  if (/culture|activity/.test(bag)) return "activity";
  return "all";
}

/**
 * URL·검색 파라미터 → v2 vertical.
 */
export function normalizeRecommendRequest(
  query: string | null | undefined,
  category: string | null | undefined,
  intent: string | null | undefined
): NormalizedRecommendRequest {
  const q = String(query ?? "").trim();
  const rawCat = String(category ?? "").trim().toLowerCase();
  const rawIntent = String(intent ?? "").trim().toLowerCase();
  const canonical = normalizeResultsExplicitCategory(category);
  const canonicalCategory = canonical ?? (rawCat || null);
  const canonicalIntent = rawIntent || null;
  const vertical = verticalFromCanonical(canonical, rawCat, rawIntent);
  return { query: q, canonicalCategory, canonicalIntent, vertical };
}

/** 파일명(`normalizeRequest`)과 맞춘 별칭 */
export const normalizeRequest = normalizeRecommendRequest;

/** 박물관/문화 계열 쿼리 — `activity_general` + 이 패턴이면 문화 strict 적용 */
export function isCultureLikeStrictQuery(query: string): boolean {
  const s = String(query ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!s) return false;
  const needles = [
    "박물관",
    "미술관",
    "전시",
    "문화",
    "도서관",
    "갤러리",
    "공연",
    "문화생활",
    "전시관",
    "예술",
    "museum",
    "gallery",
    "library",
    "exhibition",
  ];
  return needles.some((n) => s.includes(n));
}

/** `category=culture` 또는 `activity_general` + 박물관/문화 계열 쿼리 */
export function shouldApplyCultureStrictWhitelist(
  category: string | null | undefined,
  intent: string | null | undefined,
  query: string | null | undefined
): boolean {
  const canon = normalizeResultsExplicitCategory(category);
  if (canon === "culture") return true;
  const int = String(intent ?? "").trim().toLowerCase();
  if (int === "activity_general" && isCultureLikeStrictQuery(String(query ?? ""))) return true;
  return false;
}
