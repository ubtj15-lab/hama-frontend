// lib/recommendEngine.ts
import type { HomeCard } from "@lib/storeTypes";

// 사용자의 말에서 뽑아낸 선호도 프로필
export type PreferenceProfile = {
  withKids?: boolean;      // 아이랑 가기 좋은 곳?
  forWork?: boolean;       // 작업/공부하기 좋은 곳?
  priceBias?: number;      // 1(저렴) ~ 3(조금 비싼)
  requiredTags?: string[]; // "브런치", "키즈카페" 같은 태그
};

/**
 * 사용자가 말한 문장(쿼리)에서 선호도 뽑기
 * 예: "아이랑 갈 곳 추천해줘" -> withKids: true
 */
export function inferPreferenceFromText(query: string): PreferenceProfile {
  const q = query.toLowerCase();
  const pref: PreferenceProfile = {};

  // 아이랑 / 키즈
  if (q.includes("아이") || q.includes("키즈") || q.includes("키즈카페")) {
    pref.withKids = true;
  }

  // 카공 / 공부 / 작업
  if (
    q.includes("카공") ||
    q.includes("공부") ||
    q.includes("작업") ||
    q.includes("노트북")
  ) {
    pref.forWork = true;
  }

  // 가격 관련 키워드
  if (q.includes("가성비") || q.includes("저렴") || q.includes("싸")) {
    pref.priceBias = 1;
  } else if (q.includes("비싸") || q.includes("프리미엄") || q.includes("분위기")) {
    pref.priceBias = 3;
  }

  const tags: string[] = [];

  if (q.includes("브런치")) tags.push("브런치");
  if (q.includes("디저트") || q.includes("케이크")) tags.push("디저트");
  if (q.includes("한식") || q.includes("밥집")) tags.push("한식");
  if (q.includes("카페")) tags.push("카페");
  if (tags.length > 0) pref.requiredTags = tags;

  return pref;
}

/**
 * 선호도 프로필 기준으로 매장 카드들을 점수 매겨서 정렬
 */
export function rankStoresByPreference(
  cards: HomeCard[],
  pref: PreferenceProfile
): HomeCard[] {
  return cards
    .map((card) => {
      let score = 0;

      // 아이랑
      if (pref.withKids) {
        if (card.withKids) score += 3;
        else score -= 1;
      }

      // 작업/공부
      if (pref.forWork) {
        if (card.forWork) score += 3;
        else score -= 1;
      }

      // 가격 선호 (1~3)
      if (typeof pref.priceBias === "number" && typeof card.priceLevel === "number") {
        const diff = Math.abs(card.priceLevel - pref.priceBias);
        // 차이가 적을수록 점수 높게
        score += Math.max(0, 3 - diff);
      }

      // 태그 일치 개수
      if (pref.requiredTags && pref.requiredTags.length > 0 && card.tags) {
        const set = new Set(card.tags);
        let hit = 0;
        for (const t of pref.requiredTags) {
          if (set.has(t)) hit += 1;
        }
        score += hit * 2;
      }

      return { card, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ card }) => card);
}
