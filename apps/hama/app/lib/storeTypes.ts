// app/lib/storeTypes.ts

export type HomeTabKey = "all" | "restaurant" | "cafe" | "salon" | "activity" | "museum";

// DB category 값이 restaurant/cafe/salon/activity 라는 전제
export type Category = Exclude<HomeTabKey, "all">;

export type StoreRow = {
  id: string;

  name: string | null;
  category: string | null;
  area: string | null;
  address: string | null;

  lat: number | null;
  lng: number | null;

  phone: string | null;
  image_url: string | null;

  kakao_place_url: string | null;
  naver_place_id: string | null;

  mood: string[] | null;
  tags: string[] | null;

  description?: string | null;
  menu_keywords?: string[] | null;
  food_sub_category?: string | null;

  with_kids: boolean | null;
  for_work: boolean | null;
  reservation_required: boolean | null;
  vegetarian_available?: boolean | null;
  halal_available?: boolean | null;

  price_level: string | null;
  updated_at: string | null;
};

/** 홈 추천 카드 요약 배지 (짧은 라벨 + 태그) */
export type RecommendationBadge = {
  primaryLabel: string;
  shortTags: string[];
};

// ✅ API/컴포넌트에서 쓰는 “카드 모델(표준)”
export type HomeCard = {
  id: string;

  name: string;
  category: string | null;

  // UI 표시용(없으면 category 그대로 써도 됨)
  categoryLabel?: string;

  area?: string | null;
  address?: string | null;

  lat?: number | null;
  lng?: number | null;

  phone?: string | null;

  // 이미지 키가 여기저기 섞여있어서 둘 다 허용
  image_url?: string | null;
  imageUrl?: string | null;

  kakao_place_url?: string | null;
  naver_place_id?: string | null;

  // ✅ SearchResultList에서 쓰는 placeUrl (없으면 자동 생성해서 넣어줄 거임)
  placeUrl?: string | null;

  mood?: string[];
  tags?: string[];
  /** Supabase stores.menu_keywords — 음식 메뉴 키워드(선택 컬럼) */
  menu_keywords?: string[];
  /** 소개 문구(선택 컬럼) */
  description?: string | null;
  /** CHINESE | JAPANESE | … — stores.food_sub_category(선택) */
  food_sub_category?: string | null;

  // UI에서 “조용한 분위기” 같은 텍스트로 쓰는 경우가 있음
  moodText?: string;

  /** 홈 추천 등 규칙 기반 한 줄 이유 (배지 미사용·폴백용) */
  reasonText?: string;

  /** 추천 카드: [데이트] 등 pill + 짧은 태그 줄 */
  recommendBadge?: RecommendationBadge;

  // “0.5km” 같이 표시하는 경우가 있어서 optional로 둠
  distanceKm?: number;

  with_kids?: boolean | null;
  for_work?: boolean | null;
  reservation_required?: boolean | null;
  vegetarian_available?: boolean | null;
  halal_available?: boolean | null;

  price_level?: string | null;
  updated_at?: string | null;

  // 혹시 검색/추천 카드에서 쓰는 키(있으면 사용)
  quickQuery?: string;

  /** 랭킹 시 선택된 시나리오 축 — 추천 카피 다양화용(optional) */
  recommendationVoice?: "date" | "family" | "solo" | "group";

  /** meal | light | drink — 추천 문구(식사 vs 음료 전용) 보정용(optional) */
  servingType?: "meal" | "light" | "drink";

  /**
   * 클라이언트 랭킹 디버그/로깅용(optional) — UI에서 직접 쓰지 않아도 됨.
   * `useHomeCards` → `buildTopRecommendations` 결과를 얹어 둔다.
   */
  recommendationScoreBreakdown?: Record<string, number>;
};

// ✅ 기존 코드들이 Place 타입을 import하는 경우가 있어서 alias 제공
export type Place = HomeCard;

// ✅ API 라우트 더미에서 쓰는 타입들이 있으면 alias로 통일
export type StoreRecord = StoreRow;
export type ApiStoreItem = HomeCard;
