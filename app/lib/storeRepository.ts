// lib/storeRepository.ts
import type { HomeCard, HomeTabKey } from "@lib/storeTypes";

/** Fisher–Yates shuffle */
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 카테고리 정규화:
 * - beauty => salon
 * - 한글/코드/영문 혼용 방어
 */
function normalizeCategory(cat: string | null | undefined): string {
  const c = (cat ?? "").toLowerCase().trim();

  // 과거 호환
  if (c === "beauty") return "salon";

  // 한글 라벨 방어
  if (c.includes("미용") || c.includes("헤어") || c.includes("이발")) return "salon";
  if (c.includes("카페") || c.includes("커피")) return "cafe";
  if (c.includes("식당") || c.includes("음식") || c.includes("레스토랑") || c.includes("밥")) return "restaurant";
  if (c.includes("액티비") || c.includes("활동") || c.includes("체험")) return "activity";

  // 카카오 코드 방어 (혹시 들어오는 경우)
  if (c === "bk9") return "salon";
  if (c === "ce7") return "cafe";
  if (c === "fd6") return "restaurant";
  if (c === "at4") return "activity";

  return c;
}

/**
 * 카드에서 카테고리 후보를 최대한 찾아서 반환
 */
function getCardCategory(card: HomeCard): string {
  const anyCard = card as unknown as Record<string, unknown>;

  const category = anyCard["category"];
  if (typeof category === "string" && category.trim()) return category;

  const categoryLabel = anyCard["categoryLabel"];
  if (typeof categoryLabel === "string" && categoryLabel.trim()) return categoryLabel;

  const categoryCode = anyCard["categoryCode"];
  if (typeof categoryCode === "string" && categoryCode.trim()) return categoryCode;

  const category_code = anyCard["category_code"];
  if (typeof category_code === "string" && category_code.trim()) return category_code;

  return "";
}

type HomeRecommendResponse = {
  items?: unknown;
  data?: unknown;
};

function asHomeCardArray(v: unknown): HomeCard[] {
  // 런타임에서는 구조가 완벽히 동일하다는 보장이 없어서,
  // 최소한 "배열"인지 확인 후 HomeCard[]로 캐스팅
  if (!Array.isArray(v)) return [];
  return v as HomeCard[];
}

/**
 * 홈 추천 API(/api/home-recommend) 호출
 * - all: 12개
 * - 카테고리 탭: 무조건 5개
 */
export async function fetchHomeCardsByTab(
  tab: HomeTabKey,
  opts?: { lat?: number; lng?: number; limit?: number; count?: number }
): Promise<HomeCard[]> {
  try {
    const lat = opts?.lat ?? 0;
    const lng = opts?.lng ?? 0;

    const normalizedTab = normalizeCategory(String(tab));

    // ✅ UI 고정 규칙
    const wantCount = normalizedTab === "all" ? (opts?.count ?? opts?.limit ?? 12) : 5;

    // ✅ 서버에는 넉넉히 요청
    const serverCount = Math.max(100, wantCount * 20);

    const qs = new URLSearchParams();
    qs.set("lat", String(lat));
    qs.set("lng", String(lng));
    qs.set("tab", String(tab));
    qs.set("count", String(serverCount));

    const res = await fetch(`/api/home-recommend?${qs.toString()}`, {
      cache: "no-store",
    });

    if (!res.ok) return [];

    const json = (await res.json()) as HomeRecommendResponse;

    // ✅ items / data 둘 다 방어적으로 처리
    const items: HomeCard[] = asHomeCardArray(json.items ?? json.data);

    if (!items.length) return [];

    const filtered: HomeCard[] =
      normalizedTab === "all"
        ? items
        : items.filter((c: HomeCard) => normalizeCategory(getCardCategory(c)) === normalizedTab);

    if (!filtered.length) return [];

    return shuffle(filtered).slice(0, wantCount);
  } catch {
    return [];
  }
}

/** 기존 코드 호환 */
export async function fetchStores(): Promise<HomeCard[]> {
  return fetchHomeCardsByTab("all", { count: 12 });
}

export type { HomeTabKey };
