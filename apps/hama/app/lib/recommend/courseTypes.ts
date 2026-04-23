/**
 * 코스 추천 엔진 전용 타입 — `scenarioEngine`과 분리 (점진적 연동 시 어댑터 사용).
 */

export type ScenarioType = "date" | "family_kids" | "solo" | "group";

export type TimeOfDay = "morning" | "lunch" | "afternoon" | "dinner" | "night";

export type WeatherCondition = "clear" | "rainy" | "hot" | "cold" | "unknown";

export type ChildAgeGroup = "toddler" | "child" | "none" | "unknown";

/** 식사 단계 구분 — drink-only는 FOOD 단계에서 감점·제외 */
export type ServingType = "meal" | "light" | "drink";

/** 템플릿·스코어링 공통 단계 */
export type StepCategory = "FOOD" | "CAFE" | "ACTIVITY" | "WALK" | "CULTURE";

export type MovementLevel = "low" | "medium" | "high";

export type IndoorPreference = "indoor" | "outdoor" | "mixed";

/**
 * 코스 템플릿 — 시간대·연령은 `matchesContext`로 필터/가점.
 * TODO: Supabase 또는 원격 카탈로그로 이전 시 id 유지.
 */
export type CourseTemplate = {
  id: string;
  scenarios: ScenarioType[];
  steps: StepCategory[];
  movementLevel: MovementLevel;
  indoorPreference: IndoorPreference;
  /** 분위기·카피 힌트 */
  vibeTags: string[];
  /** 대략적 소요(분) — 스코어·설명용 */
  durationMinMinutes: number;
  durationMaxMinutes: number;
};

export type PlaceCandidate = {
  id: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  category?: string | null;
  categoryLabel?: string | null;
  tags?: string[];
  mood?: string[];
  /** 명시 시 inferStepCategoryFromCategory보다 우선 */
  stepCategory?: StepCategory | null;
  /** 없으면 텍스트에서 추론 */
  servingType?: ServingType | null;
  /** 0~1 품질 가정 */
  qualityScore?: number | null;
  with_kids?: boolean | null;
  reservationRequired?: boolean | null;
};

export type ScenarioContext = {
  scenario: ScenarioType;
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
  childAgeGroup?: ChildAgeGroup;
  /** 근처 후보만 — km */
  maxLegKm?: number;
  /** 혼밥 등 식사 필수 시 FOOD drink-only 제외 강화 */
  mealRequired?: boolean;
};

/** 단계별 점수 구성 (0~100 스케일 부분) */
export type StepScoreBreakdown = {
  categoryFit: number;
  scenarioFit: number;
  distanceFit: number;
  servingTimeFit: number;
  moodFit: number;
  qualityFit: number;
  childFriendlyFit: number;
  dateMoodFit: number;
  soloFriendlyFit: number;
  /** drink-only FOOD 등 */
  penalties: number;
};

export type CourseScoreBreakdown = {
  /** 단계 점수 평균·합산 기반 */
  stepsAggregate: number;
  /** 순서 자연스러움 */
  transitionScore: number;
  /** 동선 효율 */
  routeScore: number;
  /** 업종 중복·밀도 */
  diversityScore: number;
  /** 템플릿·시나리오 일치 */
  templateFitScore: number;
  /** 패턴·장소 학습 (상한 별도) */
  learnedBoost: number;
  penalties: number;
};

export type RouteLeg = {
  fromIndex: number;
  toIndex: number;
  distanceKm: number;
  travelMinutes: number;
};

/** `courseRouting.computeRouteMetrics` 결과 */
export type RouteMetrics = {
  pathKm: number;
  legs: RouteLeg[];
  travelMinutesTotal: number;
  directKm: number | null;
  /** direct/path, 0~1 */
  efficiencyRatio: number;
  /** 왕복·비효율 추정 0~100 */
  backtrackPenalty: number;
};

export type CourseStepResult = {
  order: number;
  stepCategory: StepCategory;
  place: PlaceCandidate;
  stayMinutes: number;
  stepScore: number;
  breakdown: StepScoreBreakdown;
};

export type GeneratedCourse = {
  id: string;
  title: string;
  steps: CourseStepResult[];
  route: RouteMetrics;
  totalDurationMin: number;
  humanReadableDuration: string;
  description: string;
  /** rule + learned 합성 */
  score: number;
  breakdown: CourseScoreBreakdown;
  templateId: string;
};
