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
  timeOfDay?: "morning" | "lunch" | "afternoon" | "dinner" | "night";
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

export type ScenarioConfig = {
  label: string;
  primaryBadgeLabel: string;
  preferredPlaceTypes: PlaceType[];
  tagWeights: Record<string, number>;
  defaultDurationHours?: number;
  defaultStartTime?: string;
  preferredCourseTemplates?: string[][];
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
  stops: CourseStop[];
  summaryLine: string;
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
