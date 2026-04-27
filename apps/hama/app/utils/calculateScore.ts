/** 자유 입력·테스트용 컨텍스트 (메인 추천 엔진 타입과 1:1 아님) */
export type ScoreContext = {
  who?: "family" | "solo" | "couple" | "friends" | string;
  /** 푸드/카페/액티비티 등 — `place.category` 와 직접 비교 */
  category?: string;
  isGroup?: boolean;
  /** 식사/시간대 힌트 (가산은 보수적으로) */
  time?: "morning" | "brunch" | "lunch" | "afternoon" | "dinner" | "night" | string;
};

export type ScorePlace = {
  familyFriendly?: boolean;
  soloFriendly?: boolean;
  distance?: number;
  category?: string;
  groupAvailable?: boolean;
  [key: string]: unknown;
};

export type ScoreDetail = {
  scenarioFit: number;
  distance: number;
  categoryMatch: number;
  timeContext: number;
  capability: number;
  penalty: number;
};

export function calculateScore(place: ScorePlace, context: ScoreContext) {
  let score = 0;

  const detail: ScoreDetail = {
    scenarioFit: 0,
    distance: 0,
    categoryMatch: 0,
    timeContext: 0,
    capability: 0,
    penalty: 0,
  };

  const cat = (context.category ?? "").toLowerCase();
  const t = (context.time ?? "").toLowerCase();

  // 시간 + 카테고리 시너지 (place 필드 없이 컨텍스트만으로 소폭 가산)
  if (cat === "food" && (t === "lunch" || t === "dinner" || t === "brunch")) {
    detail.timeContext += 8;
  }
  if (cat === "cafe" && (t === "morning" || t === "afternoon" || t === "brunch")) {
    detail.timeContext += 6;
  }
  if (cat === "activity" && (t === "afternoon" || t === "evening" || t === "night" || t === "dinner")) {
    detail.timeContext += 5;
  }

  // 1. 상황 (가장 중요)
  if (context.who === "family" && place.familyFriendly) {
    detail.scenarioFit += 30;
  }

  if (context.who === "solo" && place.soloFriendly) {
    detail.scenarioFit += 25;
  }

  // 2. 거리
  if (typeof place.distance === "number" && place.distance < 1) {
    detail.distance += 20;
  } else if (typeof place.distance === "number" && place.distance < 3) {
    detail.distance += 10;
  }

  // 3. 카테고리
  if (place.category === context.category) {
    detail.categoryMatch += 20;
  }

  // 4. 기능 (회식 등)
  if (context.isGroup && place.groupAvailable) {
    detail.capability += 20;
  }

  // 패널티
  if (context.isGroup && !place.groupAvailable) {
    detail.penalty -= 50;
  }

  if (context.who === "family" && !place.familyFriendly) {
    detail.penalty -= 30;
  }

  score =
    detail.scenarioFit +
    detail.distance +
    detail.categoryMatch +
    detail.timeContext +
    detail.capability +
    detail.penalty;

  return {
    total: score,
    detail,
  };
}
