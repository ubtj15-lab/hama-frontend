import type { PlaceCandidate, ScenarioContext } from "../courseTypes";

/** 서울 인근 기준 좌표 — 동선·거리 테스트용 */
export const BASE = { lat: 37.5, lng: 127.02 };

export const ctxDateEvening: ScenarioContext = {
  scenario: "date",
  timeOfDay: "dinner",
  weather: "clear",
};

export const ctxFamilyKidsToddlerRainy: ScenarioContext = {
  scenario: "family_kids",
  timeOfDay: "lunch",
  weather: "rainy",
  childAgeGroup: "toddler",
};

export const ctxSoloLunch: ScenarioContext = {
  scenario: "solo",
  timeOfDay: "lunch",
  weather: "clear",
  mealRequired: true,
};

/** 분위기 식당 */
export const placeVibeRestaurant: PlaceCandidate = {
  id: "pl-rest-vibe",
  name: "감성 파스타 분위기",
  category: "restaurant",
  lat: BASE.lat,
  lng: BASE.lng,
  tags: ["분위기", "데이트", "야경"],
  mood: ["감성"],
};

/** 감성 카페 */
export const placeMoodCafe: PlaceCandidate = {
  id: "pl-cafe-mood",
  name: "루프탑 감성 카페",
  category: "cafe",
  lat: BASE.lat + 0.002,
  lng: BASE.lng + 0.002,
  tags: ["감성", "조용"],
  mood: ["대화"],
};

/** 실내 체험·키즈 */
export const placeIndoorActivity: PlaceCandidate = {
  id: "pl-act-indoor",
  name: "실내 키즈 체험관",
  category: "activity",
  lat: BASE.lat + 0.003,
  lng: BASE.lng + 0.001,
  tags: ["실내", "키즈", "체험"],
  with_kids: true,
};

/** 돈까스 (가족 친화 키워드) */
export const placeDonkatsu: PlaceCandidate = {
  id: "pl-food-donkatsu",
  name: "왕돈까스 가족식당",
  category: "restaurant",
  lat: BASE.lat,
  lng: BASE.lng,
  tags: ["돈까스", "아이동반"],
  with_kids: true,
};

/** 횟집 — 아이 동반 하드 페널티 대상 키워드 */
export const placeSushiBar: PlaceCandidate = {
  id: "pl-food-sushi",
  name: "동해 횟집",
  category: "restaurant",
  lat: BASE.lat + 0.001,
  lng: BASE.lng,
  tags: ["회", "사시미"],
};

/** 메가커피 — drink-only 식사 후보 */
export const placeMegaCoffee: PlaceCandidate = {
  id: "pl-mega-coffee",
  name: "메가커피",
  category: "restaurant",
  lat: BASE.lat,
  lng: BASE.lng,
  tags: ["커피", "베이커리"],
};

/** 브런치 카페 */
export const placeBrunchCafe: PlaceCandidate = {
  id: "pl-brunch",
  name: "브런치 카페 모닝",
  category: "cafe",
  lat: BASE.lat + 0.002,
  lng: BASE.lng,
  tags: ["브런치", "샐러드"],
};

/** 산책로 — WALK */
export const placeWalkPark: PlaceCandidate = {
  id: "pl-walk",
  name: "한강 산책로",
  category: "park",
  stepCategory: "WALK",
  lat: BASE.lat + 0.01,
  lng: BASE.lng + 0.01,
  tags: ["산책"],
};

/** date 코스용 넉넉한 풀 */
export function poolDateEvening(): PlaceCandidate[] {
  return [
    placeVibeRestaurant,
    { ...placeMoodCafe, id: "cafe-2", name: "카페 B" },
    {
      ...placeIndoorActivity,
      id: "act-2",
      name: "미니 전시",
      lat: BASE.lat + 0.004,
      lng: BASE.lng + 0.002,
    },
  ];
}

/** FOOD→CAFE / FOOD→ACTIVITY→CAFE / CAFE→WALK 등 여러 템플릿이 동시에 채워지도록 */
export function poolDateDiverse(): PlaceCandidate[] {
  return [
    placeVibeRestaurant,
    { ...placeVibeRestaurant, id: "food-2", name: "스테이크 하우스", lat: BASE.lat + 0.001, lng: BASE.lng },
    placeMoodCafe,
    { ...placeMoodCafe, id: "cafe-2", name: "디저트 카페", lat: BASE.lat + 0.002, lng: BASE.lng + 0.003 },
    placeIndoorActivity,
    {
      ...placeIndoorActivity,
      id: "act-2",
      name: "공방 체험",
      lat: BASE.lat + 0.003,
      lng: BASE.lng + 0.002,
    },
    placeWalkPark,
  ];
}

/** family_kids 비 오는 날 — 식사·실내 액티비티·카페 다수 */
export function poolFamilyRainy(): PlaceCandidate[] {
  return [
    placeDonkatsu,
    placeSushiBar,
    placeIndoorActivity,
    {
      ...placeIndoorActivity,
      id: "pl-act-2",
      name: "실내 놀이터",
      lat: BASE.lat + 0.002,
      lng: BASE.lng + 0.003,
    },
    { ...placeMoodCafe, id: "cafe-kids", name: "키즈 디저트 카페" },
  ];
}

/** solo 점심 */
export function poolSoloLunch(): PlaceCandidate[] {
  return [
    {
      id: "pl-light-meal",
      name: "한식 점심",
      category: "restaurant",
      lat: BASE.lat,
      lng: BASE.lng,
      tags: ["한식", "점심", "혼밥"],
    },
    placeMegaCoffee,
    placeBrunchCafe,
  ];
}

/** 다양한 템플릿이 채워지도록 풍부한 풀 */
export function poolDiverseFamily(): PlaceCandidate[] {
  return [
    ...poolFamilyRainy(),
    placeWalkPark,
    {
      ...placeDonkatsu,
      id: "pl-r2",
      name: "국밥집",
      lat: BASE.lat + 0.001,
      lng: BASE.lng + 0.001,
    },
  ];
}
