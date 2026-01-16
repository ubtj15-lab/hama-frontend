// lib/storeRepository.ts
import type { HomeCard, HomeTabKey } from "@lib/storeTypes";

/** Fisher–Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 카테고리 정규화:
 * - 과거/구코드에서 beauty가 들어오면 salon으로 취급
 */
function normalizeCategory(cat: string | null | undefined): string {
  const c = (cat ?? "").toLowerCase();
  if (c === "beauty") return "salon";
  return c;
}

/**
 * 홈 추천 API(/api/home-recommend) 호출해서 cards를 받아온 뒤,
 * tab에 따라 필터 + 랜덤 섞기까지 해서 반환.
 *
 * - tab === "all" : 전체 섞어서 반환
 * - tab !== "all" : 해당 카테고리만 섞어서 반환 (beauty는 salon으로 보정)
 * - opts.limit을 주면 그 개수만 잘라서 반환
 */
export async function fetchHomeCardsByTab(
  tab: HomeTabKey,
  opts?: { lat?: number; lng?: number; limit?: number; count?: number }
): Promise<HomeCard[]> {
  try {
    const lat = opts?.lat ?? 0;
    const lng = opts?.lng ?? 0;
    const limit = opts?.limit ?? opts?.count ?? 12;

    const qs = new URLSearchParams();
    qs.set("lat", String(lat));
    qs.set("lng", String(lng));
    qs.set("tab", String(tab));
    qs.set("count", String(limit));

    const res = await fetch(`/api/home-recommend?${qs.toString()}`, {
      cache: "no-store",
    });

    if (!res.ok) return [];

    const json = (await res.json()) as { items?: HomeCard[] };
    const items = Array.isArray(json.items) ? json.items : [];

    // 탭 필터 (서버에서도 하지만, 혹시 모를 방어)
    let filtered =
      tab === "all"
        ? items
        : items.filter(
            (c) => normalizeCategory(c.categoryLabel) === normalizeCategory(tab)
          );

    // 랜덤 추천
    filtered = shuffle(filtered);

    // 필요하면 개수 제한
    if (limit && limit > 0) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  } catch {
    return [];
  }
}

/**
 * 기존 코드 호환용 (useHomeCards.ts에서 사용)
 * - 일단 "all" 기준으로 받아오면 됨
 */
export async function fetchStores(): Promise<HomeCard[]> {
  return fetchHomeCardsByTab("all", { count: 12 });
}

// page.tsx에서 type HomeTabKey를 storeRepository에서 import하고 있으면 이걸로 해결됨
export type { HomeTabKey };
