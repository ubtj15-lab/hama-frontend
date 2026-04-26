export type ScoreContext = {
  who?: "family" | "solo" | string;
  category?: string;
  isGroup?: boolean;
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
  capability: number;
  penalty: number;
};

export function calculateScore(place: ScorePlace, context: ScoreContext) {
  let score = 0;

  const detail: ScoreDetail = {
    scenarioFit: 0,
    distance: 0,
    categoryMatch: 0,
    capability: 0,
    penalty: 0,
  };

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
    detail.capability +
    detail.penalty;

  return {
    total: score,
    detail,
  };
}
