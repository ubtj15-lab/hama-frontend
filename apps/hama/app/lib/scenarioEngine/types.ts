import type { HomeCard } from "@/lib/storeTypes";

export type ScenarioType =
  | "date"
  | "family"
  | "family_kids"
  | "parent_child_outing"
  | "group"
  | "solo"
  | "parents"
  | "friends"
  | "generic";

export type UserIntentType =
  | "search_strict"
  | "scenario_recommendation"
  | "course_generation";

/** 결과 UI: 단일 장소 3장 vs 코스(동선) 3안 */
export type RecommendationMode = "single" | "course";

/** DB category / 역할 매핑용 (FOOD → restaurant, BEAUTY → salon) */
export type IntentCategory = "FOOD" | "CAFE" | "ACTIVITY" | "BEAUTY";

/** FOOD 세부 장르(태그/랭킹 보조용). intentCategory가 FOOD일 때 주로 설정 */
export type FoodSubCategory =
  | "KOREAN"
  | "CHINESE"
  | "JAPANESE"
  | "WESTERN"
  | "FASTFOOD";

/** 가족/아이 코스 — 연령대(쿼리·수동 설정) */
export type ChildAgeGroup = "toddler" | "child" | "mixed" | "unknown";

/**
 * 코스 생성용 날씨 (API 연동 전 manual override + 쿼리 추론).
 * `weatherHint`와 병합 시 `resolveWeatherCondition` 사용.
 */
export type WeatherCondition = "clear" | "rainy" | "hot" | "cold" | "bad_air" | "unknown";

/** 데이트 코스 시간대 — 유저 입력·현재 시각·쿼리 추론 */
export type DateTimeBand = "daytime" | "evening" | "night";

/** family activity 단계 세분화 — 점수·템플릿 보정용 */
export type FamilyActivityType =
  | "kids_indoor"
  | "kids_outdoor"
  | "learning"
  | "active_play"
  | "quiet_rest"
  | "mixed_family"
  | "unknown";

export type ScenarioObject = {
  intentType: UserIntentType;
  /** 자동 + 토글 반영. 인텐트 파이프라인·UI 공통 기준 */
  recommendationMode?: RecommendationMode;
  /** search_strict일 때 단일 카테고리 하드 필터 */
  intentCategory?: IntentCategory;
  /** 명시적 단일목적 검색(기본 true when intentCategory set) */
  intentStrict?: boolean;
  /** 음식 장르 힌트(FOOD + 키워드 매칭 시) */
  foodSubCategory?: FoodSubCategory;
  /** 정규화된 메뉴명(예: 짜장면, 초밥) — FOOD 랭킹·카드 태그 */
  menuIntent?: string[];
  /** 음식 취향 토큰: spicy_brothy, light_clean, light, hearty, brothy, hangover, kid_friendly_menu, parent_friendly_menu 등 */
  foodPreference?: string[];
  /** 분위기 토큰: atmospheric, calm, conversation_friendly, emotional */
  vibePreference?: string[];
  /** 반드시 맞아야 하는 조건: indoor, category_cafe, category_salon, sub_chinese, sub_korean, … */
  hardConstraints?: string[];
  /** 가점-only 조건: light, rainy_day_food, calm 등 */
  softConstraints?: string[];
  scenario: ScenarioType;
  region?: string;
  durationHours?: number;
  preferredStartTime?: string;
  includes?: string[];
  excludes?: string[];
  mood?: string[];
  groupSize?: number;
  indoorPreferred?: boolean;
  withKids?: boolean;
  withParents?: boolean;
  weatherHint?: "rain" | "snow" | "clear" | "unknown";
  /** 코스 엔진 우선 — 없으면 weatherHint·쿼리에서 `resolveWeatherCondition`으로 합성 */
  weatherCondition?: WeatherCondition;
  /** family / family_kids / parent_child_outing 코스 톤 */
  childAgeGroup?: ChildAgeGroup;
  timeOfDay?: "morning" | "brunch" | "lunch" | "afternoon" | "dinner" | "night";
  /** 데이트 코스: 낮/저녁/밤 — 없으면 쿼리·timeOfDay·현재 시각으로 `resolveDateTimeBand` */
  dateTimeBand?: DateTimeBand;
  /** 대화 누적: 가까운 곳만 선호 */
  distanceTolerance?: "near_only" | "flexible";
  /** 주차 가능 선호(소프트 가점·칩용) */
  parkingPreferred?: boolean;
  budgetLevel?: "low" | "medium" | "high";
  activityLevel?: "calm" | "mixed" | "active";
  mealRequired?: boolean;
  confidence?: number;
  rawQuery: string;
  /** 대화 메모리: 추천 엔진에서 제외할 장소 id */
  conversationExcludePlaceIds?: string[];
  /** 대화에서 거절한 음식 서브장르 */
  conversationRejectedFoodSubs?: FoodSubCategory[];
  /** 메뉴/태그 제외(짜장면 말고 등) */
  conversationExcludeMenuTerms?: string[];
};

export type PlaceType = "FOOD" | "CAFE" | "ACTIVITY" | "WALK" | "CULTURE";

/** 코스 단계별 식사/음료 역할 — drink-only는 식사 단계에서 제외 */
export type CourseServingType = "meal" | "light" | "drink";

export type ScenarioConfig = {
  label: string;
  primaryBadgeLabel: string;
  preferredPlaceTypes: PlaceType[];
  tagWeights: Record<string, number>;
  defaultDurationHours?: number;
  defaultStartTime?: string;
  preferredCourseTemplates?: PlaceType[][];
  indoorBias?: number;
  activityBias?: number;
  budgetBias?: "low" | "medium" | "high" | "mixed";
};

/** 코스 1 stop */
export type CourseStop = {
  placeId: string;
  placeName: string;
  placeType: PlaceType;
  categoryLabel?: string | null;
  /** DB stores.category (restaurant | cafe | …) */
  dbCategory?: string | null;
  /** meal | light | drink — 시나리오·단계 적합도 */
  servingType?: CourseServingType | string;
  /** 예정 방문 시작 HH:mm */
  startTime: string;
  /** 체류 분 */
  dwellMinutes: number;
  travelMinutesToNext?: number;
  businessState?: string;
  lat?: number | null;
  lng?: number | null;
  mood?: string[];
  tags?: string[];
  /** 결과 화면 고정 시 동일 카드 렌더용 */
  cardSnapshot?: HomeCard;
};

export type CoursePlan = {
  id: string;
  /** 하위 호환: 상황형 제목과 동일 */
  title: string;
  situationTitle: string;
  functionalTitle: string;
  badges: string[];
  /** 코스 카드 순서(0부터, 로깅용) */
  courseRank: number;
  scenario: ScenarioType;
  totalMinutes: number;
  template: PlaceType[];
  /** 카탈로그 템플릿 id (자동 생성 코스 구분·다양성) */
  templateId?: string;
  stops: CourseStop[];
  summaryLine: string;
  /** 짧은 한 줄 설명 (동선·톤) */
  narrativeDescription?: string;
  /** 통계 기반 학습으로 가산된 총점 (0~12 근방) */
  learningBoostTotal?: number;
  /** 학습 기반 내러티브 힌트 (popular_start 등 — UI에서만 사용 가능) */
  learningNarrativeHint?: string;
  /** 결과 페이지 q= 원문 — 코스 확정 후 돌아올 때 동일 검색 맥락 유지 */
  sourceQuery?: string;
};

export type RejectReason =
  | "closed"
  | "break_time"
  | "too_far"
  | "missing_required_type"
  | "low_scenario_score"
  | "duplicate_brand";

export type RankDebugEntry = {
  storeId: string;
  name?: string;
  rejectReason?: RejectReason;
  scoreBreakdown?: Record<string, number>;
  shortTagsReason?: string;
};

export type ScenarioEngineDebugBundle = {
  parsed?: ScenarioObject;
  configKey?: ScenarioType;
  rankSamples?: RankDebugEntry[];
  courseTemplateSelected?: string[];
  timestamp: number;
};
