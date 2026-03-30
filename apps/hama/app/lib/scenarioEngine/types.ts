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

export type UserIntentType = "place_recommendation" | "course_generation";

export type ScenarioObject = {
  intentType: UserIntentType;
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
  budgetLevel?: "low" | "medium" | "high";
  activityLevel?: "calm" | "mixed" | "active";
  mealRequired?: boolean;
  confidence?: number;
  rawQuery: string;
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
};

export type CoursePlan = {
  id: string;
  title: string;
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
