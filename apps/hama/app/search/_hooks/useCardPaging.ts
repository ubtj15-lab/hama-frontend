"use client";

import { useMemo } from "react";
import type { CardInfo, Category } from "./useSearchStores";
import { normalizeCategory } from "./useSearchStores";

type Args = {
  stores: CardInfo[];
  activeCategory: Category | null;
  query: string;
  hasMyLocation: boolean;
  myLat: number;
  myLng: number;

  exploreMode?: boolean;
  radiusKm?: number;
};

type Result = {
  categoryStores: CardInfo[];
  pages: CardInfo[][];
  usedFallbackFar?: boolean;
  usedChineseFallback?: boolean;
};

function normText(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function toNumberOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * ✅ 자연어 query에서 “의미 키워드만” 뽑기
 * - 구두점/슬래시/공백 기준 토큰화
 * - 불용어 제거(근처, 추천, 찾아줘, 뭐, 먹지 등)
 * - 남은 키워드가 없으면 [] (=> 검색 필터 안 걸림)
 */
function extractKeywords(rawQuery: string, activeCategory: Category | null): string[] {
  const raw = String(rawQuery ?? "").toLowerCase().trim();
  if (!raw) return [];

  // 카테고리 단어만 들어온 경우는 키워드로 보지 않음
  const categoryWords = new Set(
    ["카페", "cafe", "식당", "restaurant", "미용", "미용실", "beauty", "salon", "활동", "액티비티", "activity"]
      .map((x) => normText(x))
  );

  const only = normText(raw);
  if (categoryWords.has(only)) return [];

  // 토큰화(공백/구두점/슬래시/특수문자 기준)
  const tokens = raw
    .split(/[\s/|,.;:!?()\[\]{}"'`~@#$%^&*+=<>\\_-]+/g)
    .map((t) => t.trim())
    .filter(Boolean);

  // 불용어(자연어에서 거의 의미 없는 단어들) - 점심/저녁/아침은 시나리오용으로 유지
  const stop = new Set([
    "근처",
    "가까운",
    "가까이",
    "찾아줘",
    "찾아",
    "추천",
    "알려줘",
    "뭐",
    "먹지",
    "먹을까",
    "오늘",
    "내일",
    "요즘",
    "해줘",
    "해",
    "좀",
    "아",
    "그",
    "이",
    "저",
  ]);

  // 카테고리와 중복되는 키워드 제거(“카페”를 이미 탭으로 골랐으면 키워드에서 빼기)
  const categoryStop = new Set<string>();
  if (activeCategory === "cafe") categoryStop.add("카페");
  if (activeCategory === "restaurant") categoryStop.add("식당");
  if (activeCategory === "salon") categoryStop.add("미용실");
  if (activeCategory === "activity") categoryStop.add("액티비티");

  let keywords = tokens
    .filter((t) => !stop.has(t))
    .filter((t) => !categoryStop.has(t))
    .map((t) => normText(t))
    .filter((t) => t.length >= 2); // 너무 짧은 건 제거

  // 시나리오별 키워드 확장
  const scenarioExpansions: Record<string, string[]> = {
    china: ["중국집", "중국", "중식", "짜장", "짬뽕", "짜장면", "탕수", "마라", "훠궈", "딤섬", "양꼬치"],
    korean: ["한정식", "한식", "코스", "정식", "가족식사", "단체가능", "코다리", "명태", "보양식"],
    solo: ["혼밥", "혼자", "1인", "1인석", "단독", "혼술"],
    lunch: ["점심", "점심맛집", "점심식사", "런치", "브런치", "가성비", "메뉴"],
    company: ["회식", "단체", "모임", "룸", "10인", "20인", "단체가능", "회의"],
  };
  const scenarioTriggers: Record<string, (k: string) => boolean> = {
    china: (k) => k.includes("중국") || k === "중식" || k.includes("짜장") || k.includes("짬뽕"),
    korean: (k) => k.includes("한정식") || k === "한식" || k.includes("정식"),
    solo: (k) => k.includes("혼밥") || k.includes("혼자") || k === "1인",
    lunch: (k) => k.includes("점심") || k.includes("런치") || k.includes("브런치"),
    company: (k) => k.includes("회식") || k.includes("단체") || k.includes("모임"),
  };
  for (const [scenario, expand] of Object.entries(scenarioExpansions)) {
    const trigger = scenarioTriggers[scenario];
    if (keywords.some(trigger)) {
      keywords = Array.from(new Set([...keywords, ...expand]));
      break; // 한 시나리오만 적용
    }
  }

  // 중복 제거
  return Array.from(new Set(keywords));
}

type NormalizedCard = CardInfo & {
  id: string;
  name: string;
  category: Category;
  lat: number | null;
  lng: number | null;
  distanceKm?: number | null;
};

export function useCardPaging(args: Args): Result {
  const {
    stores,
    activeCategory,
    query,
    hasMyLocation,
    myLat,
    myLng,
    exploreMode = true,
    radiusKm = 3,
  } = args;

  return useMemo(() => {
    const keywords = extractKeywords(query, activeCategory);

    // 1) normalize + distance
    const normalized: NormalizedCard[] = (stores ?? [])
      .map((s) => {
        const categoryNorm = normalizeCategory((s as any).category);
        if (!categoryNorm) return null;

        const lat = toNumberOrNull((s as any).lat);
        const lng = toNumberOrNull((s as any).lng);

        let d: number | null = null;
        if (hasMyLocation && lat != null && lng != null) {
          d = distanceKm(myLat, myLng, lat, lng);
        }

        const name = String((s as any).name ?? "").trim();
        if (!name) return null;

        return {
          ...(s as any),
          id: String((s as any).id ?? ""),
          name,
          category: categoryNorm,
          lat,
          lng,
          distanceKm: d,
        } as NormalizedCard;
      })
      .filter((v): v is NormalizedCard => v !== null);

    // 2) 카테고리 스코프
    // 회식/혼밥/점심/한정식 등 식당 시나리오는 반드시 restaurant만 (미용실·액티비티·카페 제외)
    let scoped: NormalizedCard[] = normalized;
    const forceRestaurant = keywords.some((k) =>
      ["회식", "단체", "모임", "혼밥", "혼자", "점심", "한정식", "한식"].includes(k)
    );
    const effectiveCategory = activeCategory || (forceRestaurant ? "restaurant" : null);
    if (effectiveCategory) {
      scoped = scoped.filter((s) => s.category === effectiveCategory);
    }

    // 3) 키워드 검색(자연어는 키워드가 없으면 필터 자체를 안 건다)
    const beforeKeywordFilter = scoped;
    const hasChineseIntent = activeCategory === "restaurant" && keywords.some((k) =>
      ["중식", "짜장", "짬뽕", "중국집", "중국", "탕수", "마라", "훠궈", "딤섬", "양꼬치", "짜장면"].includes(k)
    );

    const hasKoreanIntent = activeCategory === "restaurant" && keywords.some((k) =>
      ["한정식", "한식", "정식", "코스"].includes(k)
    );
    const hasSoloIntent = keywords.some((k) => ["혼밥", "혼자", "1인"].includes(k));
    const hasLunchIntent = keywords.some((k) => ["점심", "런치", "브런치"].includes(k));
    const hasCompanyIntent = keywords.some((k) => ["회식", "단체", "모임"].includes(k));

    const scenarioExcludes: Record<string, string[]> = {
      china: ["한정식", "한식", "국밥", "백반", "김치", "삼겹", "갈비", "찌개", "비빔", "냉면", "분식", "족발", "보쌈", "코다리", "명태", "순대국", "해장국"],
      korean: ["중국집", "중국", "짬뽕", "짜장", "마라", "훠궈", "양꼬치", "일식", "초밥", "라멘", "양식", "파스타", "스테이크"],
      solo: ["단체전용", "10인이상", "20인이상"], // 완화: "회식"만 있으면 혼밥도 가능한 곳 있을 수 있음
      company: ["혼밥전문", "1인전용"], // 완화: "혼자"만 있으면 회식도 가능한 곳 있을 수 있음
    };

    scoped = scoped.filter((s) => {
      if (!keywords.length) return true;

      const name = normText((s as any).name ?? "");
      const addr = normText((s as any).address ?? "");
      const moodRaw = (s as any).mood;
      const mood = Array.isArray(moodRaw) ? normText(moodRaw.join(" ")) : normText(moodRaw ?? "");
      const tagsRaw = (s as any).tags;
      const tags = Array.isArray(tagsRaw) ? normText(tagsRaw.join(" ")) : normText(tagsRaw ?? "");
      const blob = `${name} ${addr} ${mood} ${tags}`;

      if (hasChineseIntent && scenarioExcludes.china.some((k) => blob.includes(k))) return false;
      if (hasKoreanIntent && scenarioExcludes.korean.some((k) => blob.includes(k))) return false;
      if (hasSoloIntent && scenarioExcludes.solo.some((k) => blob.includes(k))) return false;
      if (hasCompanyIntent && scenarioExcludes.company.some((k) => blob.includes(k))) return false;

      return keywords.some((k) => name.includes(k) || addr.includes(k) || mood.includes(k) || tags.includes(k));
    });

    // 3-1) 중국집 검색 시 → 중국집만 표시 (폴백 없이, 일식/양식 등 다른 식당 제외)
    let usedChineseFallback = false;
    if (hasChineseIntent && scoped.length === 0 && beforeKeywordFilter.length > 0) {
      // 중국 키워드가 없는 식당은 제외 (일식·양식 등 다른 카테고리 안 나오게)
      const chineseKeywords = ["중국집", "중국", "중식", "짜장", "짬뽕", "짜장면", "탕수", "마라", "훠궈", "딤섬", "양꼬치"];
      scoped = beforeKeywordFilter.filter((s) => {
        const blob = `${normText((s as any).name ?? "")} ${normText((s as any).address ?? "")} ${Array.isArray((s as any).mood) ? normText((s as any).mood.join(" ")) : ""} ${Array.isArray((s as any).tags) ? normText((s as any).tags.join(" ")) : ""}`;
        return chineseKeywords.some((k) => blob.includes(k));
      });
      usedChineseFallback = scoped.length > 0;
    }
    if (hasKoreanIntent && scoped.length === 0 && beforeKeywordFilter.length > 0) {
      const koreanKeywords = ["한정식", "한식", "정식", "코스", "가족식사", "단체가능", "코다리", "명태", "뷔페"];
      scoped = beforeKeywordFilter.filter((s) => {
        const blob = `${normText((s as any).name ?? "")} ${Array.isArray((s as any).tags) ? normText((s as any).tags.join(" ")) : ""} ${Array.isArray((s as any).mood) ? normText((s as any).mood.join(" ")) : ""}`;
        return koreanKeywords.some((k) => blob.includes(k));
      });
    }
    if (hasCompanyIntent && scoped.length === 0 && beforeKeywordFilter.length > 0) {
      const companyKeywords = ["회식", "단체", "모임", "룸", "단체가능"];
      scoped = beforeKeywordFilter.filter((s) => {
        const blob = `${normText((s as any).name ?? "")} ${Array.isArray((s as any).tags) ? normText((s as any).tags.join(" ")) : ""} ${Array.isArray((s as any).mood) ? normText((s as any).mood.join(" ")) : ""}`;
        return companyKeywords.some((k) => blob.includes(k));
      });
      // 태그 있는 곳 없으면 → 식당 전체 표시 (회식 가능한 곳)
      if (scoped.length === 0) scoped = beforeKeywordFilter;
    }
    if (hasSoloIntent && scoped.length === 0 && beforeKeywordFilter.length > 0) {
      const soloKeywords = ["혼밥", "혼자", "1인", "1인석"];
      scoped = beforeKeywordFilter.filter((s) => {
        const blob = `${normText((s as any).name ?? "")} ${Array.isArray((s as any).tags) ? normText((s as any).tags.join(" ")) : ""} ${Array.isArray((s as any).mood) ? normText((s as any).mood.join(" ")) : ""}`;
        return soloKeywords.some((k) => blob.includes(k));
      });
      // 태그 있는 곳 없으면 → 식당 전체 표시 (혼밥 가능한 곳)
      if (scoped.length === 0) scoped = beforeKeywordFilter;
    }
    if (hasLunchIntent && scoped.length === 0 && beforeKeywordFilter.length > 0) {
      const lunchKeywords = ["점심", "점심맛집", "점심식사", "런치", "브런치", "가성비"];
      scoped = beforeKeywordFilter.filter((s) => {
        const blob = `${normText((s as any).name ?? "")} ${Array.isArray((s as any).tags) ? normText((s as any).tags.join(" ")) : ""}`;
        return lunchKeywords.some((k) => blob.includes(k));
      });
      if (scoped.length === 0) scoped = beforeKeywordFilter;
    }

    // 4) 정렬: 시나리오별 우선순위 키워드 많은 순 → 거리순
    const scenarioPriority: Record<string, string[]> = {
      china: ["중국집", "중국", "중식", "짜장", "짬뽕", "짜장면", "탕수", "마라", "훠궈", "딤섬", "양꼬치"],
      korean: ["한정식", "한식", "정식", "코스", "가족식사"],
      solo: ["혼밥", "혼자", "1인", "1인석"],
      lunch: ["점심", "점심맛집", "점심식사", "런치", "브런치", "가성비"],
      company: ["회식", "단체", "모임", "룸", "단체가능"],
    };
    const activeScenario = hasChineseIntent ? "china" : hasKoreanIntent ? "korean" : hasSoloIntent ? "solo" : hasLunchIntent ? "lunch" : hasCompanyIntent ? "company" : null;
    if (activeScenario && scenarioPriority[activeScenario]) {
      const priorityKw = scenarioPriority[activeScenario];
      const countMatch = (s: NormalizedCard) => {
        const blob = `${normText((s as any).name ?? "")} ${Array.isArray((s as any).tags) ? normText((s as any).tags.join(" ")) : ""} ${Array.isArray((s as any).mood) ? normText((s as any).mood.join(" ")) : ""}`;
        return priorityKw.filter((k) => blob.includes(k)).length;
      };
      scoped = scoped.sort((a, b) => {
        const ca = countMatch(a);
        const cb = countMatch(b);
        if (cb !== ca) return cb - ca;
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return da - db;
      });
    } else if (hasMyLocation) {
      scoped = scoped.sort((a, b) => {
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return da - db;
      });
    }

    // 5) 근처 탐색 반경 + fallback
    let usedFallbackFar = false;

    if (exploreMode && hasMyLocation) {
      const nearby = scoped.filter((s) => (s.distanceKm ?? Number.POSITIVE_INFINITY) <= radiusKm);

      if (nearby.length > 0) {
        scoped = nearby;
      } else {
        // ✅ 근처 0개면 “가까운 순 상위”로라도 유지
        usedFallbackFar = true;
        scoped = scoped.slice(0, 200);
      }
    }

    let categoryStores: CardInfo[] = scoped;

    // 마지막 폴백: 결과 0개면 키워드만 적용
    // 시나리오 검색(회식/혼밥/한정식 등) 시 다른 카테고리(미용실/액티비티/카페) 노출 금지
    const hasStrictScenario = hasChineseIntent || hasKoreanIntent || hasSoloIntent || hasCompanyIntent || hasLunchIntent;
    if (categoryStores.length === 0 && normalized.length > 0 && !hasStrictScenario) {
      // activeCategory가 있으면 해당 카테고리만 (회식·혼밥은 식당만)
      let pool = normalized;
      if (activeCategory) pool = pool.filter((s) => s.category === activeCategory);
      const keywordFiltered = keywords.length > 0
        ? pool.filter((s) => {
            const name = normText((s as any).name ?? "");
            const tags = Array.isArray((s as any).tags) ? normText((s as any).tags.join(" ")) : "";
            return keywords.some((k) => name.includes(k) || tags.includes(k));
          })
        : pool;
      categoryStores = keywordFiltered.length > 0 ? keywordFiltered.slice(0, 200) : pool.slice(0, 200);
    }

    // ✅ 추천 카드 랜덤 순서 (같은 검색어여도 매번 다르게)
    const shuffled = [...categoryStores].sort(() => Math.random() - 0.5);
    const pages: CardInfo[][] = [
      shuffled.slice(0, 3),
      shuffled.slice(3, 6),
      shuffled.slice(6, 9),
    ];

    return { categoryStores: shuffled, pages, usedFallbackFar, usedChineseFallback };
  }, [stores, activeCategory, query, hasMyLocation, myLat, myLng, exploreMode, radiusKm]);
}
