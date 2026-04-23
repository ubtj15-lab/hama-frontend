import type { ChildAgeGroup, DateTimeBand, PlaceType, ScenarioType, WeatherCondition } from "@/lib/scenarioEngine/types";

/** 코스 학습용 로그 이벤트 (logEvent type 필드와 동일하게 사용) */
export type CourseLearningEventName =
  | "course_impression"
  | "course_start_click"
  | "course_save"
  | "first_place_route_click"
  | "course_place_detail_click"
  | "course_call_click"
  | "course_card_click"
  | "course_detail_view"
  | "long_view_time"
  | "immediate_exit"
  | "no_action_after_impression"
  | "repeated_skip";

/** logEvent / API 적재용 공통 페이로드 */
export type CourseLearningLogPayload = {
  courseId: string;
  templateId: string;
  scenario: ScenarioType;
  childAgeGroup?: ChildAgeGroup;
  weatherCondition?: WeatherCondition;
  /** morning | lunch | … 또는 dateTimeBand와 함께 사용 가능 */
  timeOfDay?: string;
  dateTimeBand?: DateTimeBand;
  stepCategories: PlaceType[];
  placeIds: string[];
  sourcePage?: string;
  rank?: number;
  /** 추가 메타 (체류 ms 등) */
  dwellMs?: number;
  /** 향후 개인화: 로그인 유저 id */
  userId?: string;
  /** 향후 세그먼트 (예: family_heavy, activity_heavy) — 집계 키 확장용 */
  userSegment?: string;
};

/** 템플릿 단계 문자열 FOOD>CAFE>WALK */
export type StepPatternString = string;

/** 집계 행 — 템플릿·시나리오 조합별 */
export type CoursePatternStats = {
  key: string;
  scenario: ScenarioType;
  childAgeGroup?: string;
  weatherCondition?: string;
  timeOfDay?: string;
  dateTimeBand?: string;
  templateId: string;
  stepPattern: StepPatternString;
  impressions: number;
  clicks: number;
  starts: number;
  saves: number;
  detailViews: number;
  routeClicks: number;
  callClicks: number;
  exits: number;
  noActions: number;
  skips: number;
  /** 가중 이벤트 합 (디버그·분석용) */
  behaviorScoreSum: number;
};

export type PlaceCourseStats = {
  placeId: string;
  impressions: number;
  clicks: number;
  starts: number;
  saves: number;
  detailViews: number;
  exits: number;
  behaviorScoreSum: number;
};

/** 코스 특성 태그 — 패턴 집계 보조 */
export type CourseFeatureTag =
  | "indoor_heavy"
  | "short_distance"
  | "active"
  | "calm"
  | "family_friendly"
  | "date_mood";

export type CourseFeatureBucketStats = {
  key: string;
  features: CourseFeatureTag[];
  scenario: ScenarioType;
  impressions: number;
  starts: number;
  saves: number;
  clicks: number;
};

/**
 * 최종 코스 점수: rule 기반 `computeCourseScore` + `total`(학습 가산, 상한 LEARNED_BOOST_MAX_TOTAL).
 * `total` = scenarioPatternBoost + placeBoost + featureBoost + templateBoost×0.42 (동일 스케일로 합산 후 상한).
 * impressions 가 MIN_IMPRESSIONS_ANY 미만이면 패턴/장소 품질 기여는 거의 0.
 */
export type LearnedBoostParts = {
  templateBoost: number;
  scenarioPatternBoost: number;
  placeBoost: number;
  featureBoost: number;
  total: number;
  /** `recommendation_pattern_stats.learned_boost` 에서 merge (0~4 가산, 상한은 total 내) */
  recommendationPatternTableBoost?: number;
  /** 내러티브 보조 (점수 임계 넘을 때만) */
  narrativeHint?: CourseLearningNarrativeHint;
};

export type CourseLearningNarrativeHint =
  | "popular_start"
  | "saved_often"
  | "family_chosen"
  | "date_evening_popular";
