import { computeTemplateSelectionLearnedBoost } from "@/lib/courseLearning/courseLearningBoost";
import type { CourseLearningStore } from "@/lib/courseLearning/courseLearningStore";
import { resolveDateTimeBand } from "./dateCourseContext";
import { resolveWeatherCondition, isFamilyLikeScenario } from "./familyCourseContext";
import type {
  ChildAgeGroup,
  DateTimeBand,
  ScenarioObject,
  ScenarioType,
  PlaceType,
  ScenarioConfig,
} from "./types";

/** 식사 후 에너지 해소·체험 단계(실내 놀이, 공원, 전시 등) */
export function courseHasEnergyOrPlayStep(steps: PlaceType[]): boolean {
  return steps.includes("ACTIVITY") || steps.includes("WALK") || steps.includes("CULTURE");
}

function isFoodCafeOnly(steps: PlaceType[]): boolean {
  return steps.length === 2 && steps[0] === "FOOD" && steps[1] === "CAFE";
}

export type MovementLevel = "low" | "medium" | "high";
export type IndoorPreference = "indoor" | "outdoor" | "mixed";

/** 시나리오별 코스 템플릿 정의 */
export type CourseTemplateDefinition = {
  id: string;
  /** 비어 있으면 모든 시나리오에 적용 가능(generic 전용 등) */
  scenarios: ScenarioType[];
  steps: PlaceType[];
  movementLevel: MovementLevel;
  indoorPreference: IndoorPreference;
  durationMinMinutes: number;
  durationMaxMinutes: number;
  /** 다양성·설명용 키워드 */
  vibeTags: string[];
  /** 데이트: 강하게 맞는 시간대(없으면 전 시간대 중립) */
  dateTimeBands?: DateTimeBand[];
  /** 데이트 3안: 활동형 / 감성 / 가벼운 동선 */
  dateCourseKind?: "activity" | "mood" | "light";
  /** 비어 있으면 모든 연령대. 지정 시 해당 연령에서만 노출(예: 유아 전용 동선) */
  childAgeGroups?: ChildAgeGroup[];
};

export const COURSE_TEMPLATE_CATALOG: CourseTemplateDefinition[] = [
  // date
  {
    id: "date-food-cafe-walk",
    scenarios: ["date"],
    steps: ["FOOD", "CAFE", "WALK"],
    movementLevel: "medium",
    indoorPreference: "mixed",
    durationMinMinutes: 180,
    durationMaxMinutes: 280,
    vibeTags: ["대화", "산책", "클래식"],
    dateCourseKind: "mood",
  },
  {
    id: "date-food-activity-cafe",
    scenarios: ["date"],
    steps: ["FOOD", "ACTIVITY", "CAFE"],
    movementLevel: "high",
    indoorPreference: "indoor",
    durationMinMinutes: 220,
    durationMaxMinutes: 320,
    vibeTags: ["활동", "체험", "에너지"],
    dateCourseKind: "activity",
  },
  {
    id: "date-cafe-culture-food",
    scenarios: ["date"],
    steps: ["CAFE", "CULTURE", "FOOD"],
    movementLevel: "medium",
    indoorPreference: "indoor",
    durationMinMinutes: 200,
    durationMaxMinutes: 300,
    vibeTags: ["문화", "감성", "저녁식사"],
    dateCourseKind: "mood",
  },
  {
    id: "date-cafe-activity-food",
    scenarios: ["date"],
    steps: ["CAFE", "ACTIVITY", "FOOD"],
    movementLevel: "high",
    indoorPreference: "mixed",
    durationMinMinutes: 200,
    durationMaxMinutes: 300,
    vibeTags: ["카페", "활동", "식사"],
    dateCourseKind: "activity",
  },
  /** [daytime] 브런치 → 카페 → 산책 */
  {
    id: "date-day-brunch-cafe-walk",
    scenarios: ["date"],
    steps: ["FOOD", "CAFE", "WALK"],
    movementLevel: "medium",
    indoorPreference: "mixed",
    durationMinMinutes: 160,
    durationMaxMinutes: 260,
    vibeTags: ["브런치", "카페", "산책"],
    dateTimeBands: ["daytime"],
    dateCourseKind: "mood",
  },
  /** [daytime] 카페 → 액티비티 → 레스토랑 */
  {
    id: "date-day-cafe-activity-food",
    scenarios: ["date"],
    steps: ["CAFE", "ACTIVITY", "FOOD"],
    movementLevel: "high",
    indoorPreference: "mixed",
    durationMinMinutes: 200,
    durationMaxMinutes: 300,
    vibeTags: ["카페", "체험", "식사"],
    dateTimeBands: ["daytime"],
    dateCourseKind: "activity",
  },
  /** [daytime] 브런치 → 문화 → 카페 */
  {
    id: "date-day-food-culture-cafe",
    scenarios: ["date"],
    steps: ["FOOD", "CULTURE", "CAFE"],
    movementLevel: "medium",
    indoorPreference: "indoor",
    durationMinMinutes: 200,
    durationMaxMinutes: 300,
    vibeTags: ["전시", "감성", "카페"],
    dateTimeBands: ["daytime"],
    dateCourseKind: "mood",
  },
  /** [evening] 식당 → 카페 */
  {
    id: "date-eve-food-cafe",
    scenarios: ["date"],
    steps: ["FOOD", "CAFE"],
    movementLevel: "low",
    indoorPreference: "indoor",
    durationMinMinutes: 120,
    durationMaxMinutes: 200,
    vibeTags: ["식사", "카페", "가벼움"],
    dateTimeBands: ["evening"],
    dateCourseKind: "light",
  },
  /** [evening] 식당 → 산책 → 카페 */
  {
    id: "date-eve-food-walk-cafe",
    scenarios: ["date"],
    steps: ["FOOD", "WALK", "CAFE"],
    movementLevel: "medium",
    indoorPreference: "mixed",
    durationMinMinutes: 200,
    durationMaxMinutes: 300,
    vibeTags: ["식사", "산책", "카페"],
    dateTimeBands: ["evening"],
    dateCourseKind: "mood",
  },
  /** [evening] 식당 → 액티비티 → 카페 */
  {
    id: "date-eve-food-activity-cafe",
    scenarios: ["date"],
    steps: ["FOOD", "ACTIVITY", "CAFE"],
    movementLevel: "high",
    indoorPreference: "indoor",
    durationMinMinutes: 220,
    durationMaxMinutes: 320,
    vibeTags: ["식사", "체험", "카페"],
    dateTimeBands: ["evening"],
    dateCourseKind: "activity",
  },
  /** [night] 카페 → 산책(야경) */
  {
    id: "date-night-cafe-walk",
    scenarios: ["date"],
    steps: ["CAFE", "WALK"],
    movementLevel: "low",
    indoorPreference: "mixed",
    durationMinMinutes: 100,
    durationMaxMinutes: 180,
    vibeTags: ["야경", "산책", "밤"],
    dateTimeBands: ["night"],
    dateCourseKind: "mood",
  },
  /** [night] 야경·전시 → 카페 */
  {
    id: "date-night-culture-cafe",
    scenarios: ["date"],
    steps: ["CULTURE", "CAFE"],
    movementLevel: "low",
    indoorPreference: "indoor",
    durationMinMinutes: 120,
    durationMaxMinutes: 200,
    vibeTags: ["야경", "전시", "카페"],
    dateTimeBands: ["night"],
    dateCourseKind: "mood",
  },
  /** [night] 디저트(경식사) → 산책 */
  {
    id: "date-night-food-walk",
    scenarios: ["date"],
    steps: ["FOOD", "WALK"],
    movementLevel: "low",
    indoorPreference: "mixed",
    durationMinMinutes: 90,
    durationMaxMinutes: 160,
    vibeTags: ["디저트", "산책", "밤"],
    dateTimeBands: ["night"],
    dateCourseKind: "light",
  },
  // family
  {
    id: "family-food-activity-cafe",
    scenarios: ["family"],
    steps: ["FOOD", "ACTIVITY", "CAFE"],
    movementLevel: "medium",
    indoorPreference: "mixed",
    durationMinMinutes: 180,
    durationMaxMinutes: 280,
    vibeTags: ["가족", "아이", "실내"],
  },
  /** 식당 → 액티비티 기본 2단 (카페 없음) */
  {
    id: "family-food-activity",
    scenarios: ["family", "family_kids", "parent_child_outing"],
    steps: ["FOOD", "ACTIVITY"],
    movementLevel: "medium",
    indoorPreference: "mixed",
    durationMinMinutes: 140,
    durationMaxMinutes: 240,
    vibeTags: ["가족", "식사", "놀이"],
  },
  {
    id: "family-activity-food",
    scenarios: ["family"],
    steps: ["ACTIVITY", "FOOD"],
    movementLevel: "medium",
    indoorPreference: "indoor",
    durationMinMinutes: 140,
    durationMaxMinutes: 220,
    vibeTags: ["놀이", "식사"],
  },
  {
    id: "family-food-walk-cafe",
    scenarios: ["family", "family_kids", "parent_child_outing"],
    steps: ["FOOD", "WALK", "CAFE"],
    movementLevel: "low",
    indoorPreference: "outdoor",
    durationMinMinutes: 160,
    durationMaxMinutes: 260,
    vibeTags: ["산책", "공원", "가벼움"],
  },
  // family_kids / parent_child_outing
  {
    id: "kids-activity-food-cafe",
    scenarios: ["family_kids", "parent_child_outing"],
    steps: ["ACTIVITY", "FOOD", "CAFE"],
    movementLevel: "low",
    indoorPreference: "indoor",
    durationMinMinutes: 200,
    durationMaxMinutes: 300,
    vibeTags: ["아이동반", "실내", "여유"],
  },
  {
    id: "kids-walk-food-cafe",
    scenarios: ["parent_child_outing", "family_kids"],
    steps: ["WALK", "FOOD", "CAFE"],
    movementLevel: "low",
    indoorPreference: "mixed",
    durationMinMinutes: 180,
    durationMaxMinutes: 280,
    vibeTags: ["산책", "나들이"],
  },
  {
    id: "kids-culture-cafe-food",
    scenarios: ["family_kids", "parent_child_outing"],
    steps: ["CULTURE", "CAFE", "FOOD"],
    movementLevel: "low",
    indoorPreference: "indoor",
    durationMinMinutes: 200,
    durationMaxMinutes: 300,
    vibeTags: ["체험", "문화"],
  },
  /** 키즈카페 등 식사 후 가벼운 카페 — 아이랑 전용(2단). 일반 family 기본 후보에서는 점수로 후순위 */
  {
    id: "kids-food-cafe",
    scenarios: ["family_kids", "parent_child_outing"],
    steps: ["FOOD", "CAFE"],
    movementLevel: "low",
    indoorPreference: "indoor",
    durationMinMinutes: 120,
    durationMaxMinutes: 200,
    vibeTags: ["키즈", "카페", "가벼움"],
  },
  /** 유아(toddler): 식사 → 실내 액티비티 (짧은 동선) */
  {
    id: "toddler-food-activity",
    scenarios: ["family", "family_kids", "parent_child_outing"],
    steps: ["FOOD", "ACTIVITY"],
    movementLevel: "low",
    indoorPreference: "indoor",
    durationMinMinutes: 120,
    durationMaxMinutes: 200,
    vibeTags: ["유아", "실내", "키즈"],
    childAgeGroups: ["toddler"],
  },
  /** 유아: 식사 → 짧은 공원·산책 (맑은 날·부담 적을 때) */
  {
    id: "toddler-food-walk",
    scenarios: ["family", "family_kids", "parent_child_outing"],
    steps: ["FOOD", "WALK"],
    movementLevel: "low",
    indoorPreference: "outdoor",
    durationMinMinutes: 100,
    durationMaxMinutes: 180,
    vibeTags: ["유아", "공원", "짧게"],
    childAgeGroups: ["toddler"],
  },
  /** 유아: 실내 놀이 → 식사 (동선 짧을 때) */
  {
    id: "toddler-activity-food",
    scenarios: ["family", "family_kids", "parent_child_outing"],
    steps: ["ACTIVITY", "FOOD"],
    movementLevel: "low",
    indoorPreference: "indoor",
    durationMinMinutes: 120,
    durationMaxMinutes: 200,
    vibeTags: ["유아", "실내", "한끼"],
    childAgeGroups: ["toddler"],
  },
  /** 유아: 식사 → 실내 활동 → 카페(가벼운 마무리) */
  {
    id: "toddler-food-activity-cafe",
    scenarios: ["family", "family_kids", "parent_child_outing"],
    steps: ["FOOD", "ACTIVITY", "CAFE"],
    movementLevel: "medium",
    indoorPreference: "indoor",
    durationMinMinutes: 180,
    durationMaxMinutes: 260,
    vibeTags: ["유아", "실내", "여유"],
    childAgeGroups: ["toddler"],
  },
  // solo
  {
    id: "solo-food-cafe",
    scenarios: ["solo"],
    steps: ["FOOD", "CAFE"],
    movementLevel: "low",
    indoorPreference: "indoor",
    durationMinMinutes: 90,
    durationMaxMinutes: 160,
    vibeTags: ["혼밥", "루틴"],
  },
  {
    id: "solo-cafe-walk",
    scenarios: ["solo"],
    steps: ["CAFE", "WALK"],
    movementLevel: "low",
    indoorPreference: "outdoor",
    durationMinMinutes: 80,
    durationMaxMinutes: 150,
    vibeTags: ["산책", "한잔"],
  },
  {
    id: "solo-cafe-only",
    scenarios: ["solo"],
    steps: ["CAFE"],
    movementLevel: "low",
    indoorPreference: "indoor",
    durationMinMinutes: 45,
    durationMaxMinutes: 100,
    vibeTags: ["가벼움", "라이트"],
  },
  {
    id: "solo-culture-food",
    scenarios: ["solo"],
    steps: ["CULTURE", "FOOD"],
    movementLevel: "low",
    indoorPreference: "indoor",
    durationMinMinutes: 120,
    durationMaxMinutes: 200,
    vibeTags: ["혼자", "문화"],
  },
  // group / friends
  {
    id: "group-food-cafe",
    scenarios: ["group", "friends"],
    steps: ["FOOD", "CAFE"],
    movementLevel: "low",
    indoorPreference: "mixed",
    durationMinMinutes: 160,
    durationMaxMinutes: 240,
    vibeTags: ["회식", "수다"],
  },
  {
    id: "group-food-activity-cafe",
    scenarios: ["group", "friends"],
    steps: ["FOOD", "ACTIVITY", "CAFE"],
    movementLevel: "high",
    indoorPreference: "mixed",
    durationMinMinutes: 220,
    durationMaxMinutes: 340,
    vibeTags: ["단체", "활동"],
  },
  {
    id: "group-activity-food",
    scenarios: ["group"],
    steps: ["ACTIVITY", "FOOD"],
    movementLevel: "medium",
    indoorPreference: "mixed",
    durationMinMinutes: 160,
    durationMaxMinutes: 260,
    vibeTags: ["액티비티", "식사"],
  },
  {
    id: "friends-cafe-activity-food",
    scenarios: ["friends"],
    steps: ["CAFE", "ACTIVITY", "FOOD"],
    movementLevel: "medium",
    indoorPreference: "indoor",
    durationMinMinutes: 200,
    durationMaxMinutes: 300,
    vibeTags: ["친구", "놀기"],
  },
  // parents
  {
    id: "parents-food-cafe-walk",
    scenarios: ["parents"],
    steps: ["FOOD", "CAFE", "WALK"],
    movementLevel: "low",
    indoorPreference: "mixed",
    durationMinMinutes: 180,
    durationMaxMinutes: 260,
    vibeTags: ["부모님", "여유"],
  },
  {
    id: "parents-culture-food",
    scenarios: ["parents"],
    steps: ["CULTURE", "FOOD"],
    movementLevel: "low",
    indoorPreference: "indoor",
    durationMinMinutes: 160,
    durationMaxMinutes: 240,
    vibeTags: ["문화", "한끼"],
  },
  // generic
  {
    id: "generic-food-cafe",
    scenarios: ["generic"],
    steps: ["FOOD", "CAFE"],
    movementLevel: "low",
    indoorPreference: "mixed",
    durationMinMinutes: 120,
    durationMaxMinutes: 200,
    vibeTags: ["기본"],
  },
  {
    id: "generic-food-activity-cafe",
    scenarios: ["generic"],
    steps: ["FOOD", "ACTIVITY", "CAFE"],
    movementLevel: "medium",
    indoorPreference: "mixed",
    durationMinMinutes: 200,
    durationMaxMinutes: 300,
    vibeTags: ["다양"],
  },
];

function templateAppliesToScenario(def: CourseTemplateDefinition, scenario: ScenarioType): boolean {
  if (def.scenarios.length === 0) return true;
  return def.scenarios.includes(scenario);
}

/** 시나리오·유저 신호로 템플릿 적합도 점수 (대략 0~120) */
export function scoreTemplateSelection(
  def: CourseTemplateDefinition,
  obj: ScenarioObject,
  config: ScenarioConfig
): number {
  let s = 40;
  if (!templateAppliesToScenario(def, obj.scenario)) return -100;

  const wx = resolveWeatherCondition(obj);
  const badOutdoorWeather =
    wx === "rainy" || wx === "hot" || wx === "cold" || wx === "bad_air";
  const rain = wx === "rainy" || obj.weatherHint === "rain" || obj.weatherHint === "snow";
  const indoor = obj.indoorPreferred === true;
  const age = obj.childAgeGroup ?? "unknown";
  const night = obj.timeOfDay === "night" || obj.timeOfDay === "dinner";
  const withKids = obj.withKids === true;
  const calm = obj.activityLevel === "calm";
  const active = obj.activityLevel === "active";
  const nearOnly = obj.distanceTolerance === "near_only";
  const mealReq = obj.mealRequired === true;

  if (def.steps.includes("WALK")) {
    if (rain || indoor) s -= 22;
    if (badOutdoorWeather) s -= 12;
    if (night && withKids) s -= 12;
    if (nearOnly) s -= 8;
  }
  if (def.movementLevel === "high" && calm) s -= 15;
  if (def.movementLevel === "low" && active) s -= 8;
  if (def.movementLevel === "high" && active) s += 12;
  if (def.indoorPreference === "indoor" && (rain || indoor || badOutdoorWeather)) s += 14;
  if (def.indoorPreference === "outdoor" && !rain && !indoor && !badOutdoorWeather) s += 10;

  if (withKids && def.steps.includes("ACTIVITY")) s += 10;
  if (withKids && def.movementLevel === "high") s -= 6;

  if (obj.withParents && def.movementLevel === "low") s += 8;

  if (mealReq && def.steps.filter((x) => x === "FOOD").length >= 1) s += 14;

  if ((config.indoorBias ?? 0) > 0.2 && def.indoorPreference === "indoor") s += 6;
  if ((config.activityBias ?? 0) > 0.35 && def.steps.includes("ACTIVITY")) s += 10;

  const moodHay = (obj.mood ?? []).join(" ");
  if (/걷기|산책/.test(moodHay) && def.steps.includes("WALK")) s += 12;
  if (/많이\s*걷기\s*싫|안\s*걷|근처|가까운/.test(obj.rawQuery) && def.movementLevel === "low") s += 14;
  if (/실내/.test(moodHay) && def.indoorPreference === "indoor") s += 10;

  const sk = obj.scenario;

  /** 데이트: 시간대·날씨·실내 야외 */
  if (sk === "date") {
    const band = resolveDateTimeBand(obj);
    if (def.dateTimeBands && def.dateTimeBands.length > 0) {
      if (def.dateTimeBands.includes(band)) s += 28;
      else s -= 26;
    }
    if (band === "evening" && def.id === "date-eve-food-cafe") s += 14;
    if (band === "evening" && def.id === "date-eve-food-walk-cafe") s += 10;
    if (band === "night" && (def.id === "date-night-cafe-walk" || def.id === "date-night-culture-cafe")) s += 10;

    if (wx === "rainy" || wx === "bad_air") {
      if (def.steps.includes("WALK")) s -= 40;
      if (def.indoorPreference === "indoor") s += 18;
    }
    if (wx === "hot") {
      if (def.steps.includes("WALK")) {
        s -= band === "daytime" ? 38 : band === "evening" ? 14 : 10;
      }
      if (def.indoorPreference === "indoor") s += 14;
    }
    if (wx === "cold") {
      if (def.steps.includes("WALK")) s -= 22;
      if (def.indoorPreference === "indoor") s += 12;
    }
    if (wx === "clear" && def.steps.includes("WALK")) s += 10;
  }

  /** 가족(일반): 데이트형 식당→카페 단독 금지 — 반드시 놀이·산책·체험 등 에너지 단계 */
  if (sk === "family") {
    if (isFoodCafeOnly(def.steps)) return -100;
    if (!courseHasEnergyOrPlayStep(def.steps)) return -100;
  }

  /** 아이랑: 활동·산책·체험 우선, 식당→카페 2단만은 후순위(키즈카페 예외 허용) */
  if (sk === "family_kids" || sk === "parent_child_outing") {
    if (isFoodCafeOnly(def.steps)) s -= 20;
    if (courseHasEnergyOrPlayStep(def.steps)) s += 16;
    if (def.steps.includes("ACTIVITY")) s += 14;
    if (def.steps.includes("WALK")) s += 10;
    if (def.id === "kids-food-cafe") s -= 8;
    if (def.id === "kids-food-cafe" && (wx === "rainy" || wx === "bad_air")) s -= 28;
  }

  if ((sk === "family" || sk === "family_kids" || sk === "parent_child_outing") && def.steps.includes("ACTIVITY")) {
    s += 12;
  }

  /** 가족: 연령대·날씨별 템플릿 보정 */
  if (isFamilyLikeScenario(sk)) {
    if (badOutdoorWeather) {
      if (def.steps.includes("WALK")) s -= age === "toddler" ? 36 : 26;
      if (def.indoorPreference === "indoor") s += 20;
      if (def.indoorPreference === "outdoor") s -= 20;
      if (def.steps[0] === "FOOD" && def.steps.includes("ACTIVITY") && def.indoorPreference === "indoor") s += 10;
    }
    if (wx === "clear" && age === "child") {
      if (def.steps.includes("WALK")) s += 12;
      if (def.indoorPreference === "outdoor") s += 8;
      if (def.id === "family-food-walk-cafe" || def.id === "kids-walk-food-cafe") s += 6;
    }
    if (age === "toddler") {
      if (def.movementLevel === "high") s -= 14;
      if (def.steps.includes("WALK")) s -= 10;
      if (def.indoorPreference === "indoor") s += 10;
      if (def.steps.length >= 4) s -= 8;
      if (def.id === "family-food-activity" || def.id === "family-food-activity-cafe") s += 8;
    }
    if (age === "child") {
      if (def.steps.includes("ACTIVITY")) s += 8;
      if (!courseHasEnergyOrPlayStep(def.steps) && def.steps.includes("CAFE")) s -= 18;
      if (def.id === "kids-food-cafe") s -= 14;
    }
    if (age === "mixed" || age === "unknown") {
      if (def.steps.includes("WALK")) s -= 8;
      if (def.indoorPreference === "indoor") s += 6;
      if (def.movementLevel === "high") s -= 8;
    }
    if (sk === "family" && def.steps[0] === "FOOD" && def.steps.includes("ACTIVITY")) s += 6;
    if (def.childAgeGroups?.includes("toddler") && age === "toddler") s += 12;
    if (def.id?.startsWith("toddler-") && age === "toddler" && badOutdoorWeather) {
      if (def.steps.includes("ACTIVITY") && def.indoorPreference === "indoor") s += 10;
    }
  }

  if (sk === "date" && def.id === "date-cafe-activity-food") s += 4;

  if (obj.scenario === "solo" && def.steps.length === 1 && def.steps[0] === "CAFE") s += 8;

  if (obj.scenario === "solo" && def.steps.length <= 2) s += 6;

  // 다양성: 템플릿 id 해시로 미세 tie-break
  let h = 0;
  for (let i = 0; i < def.id.length; i++) h = (h * 31 + def.id.charCodeAt(i)) >>> 0;
  s += (h % 5) * 0.01;

  return s;
}

function templateAppliesToChildAgeGroup(
  def: CourseTemplateDefinition,
  age: ChildAgeGroup | undefined
): boolean {
  if (!def.childAgeGroups?.length) return true;
  /** 연령 미지정이면 유아 전용 동선은 제외(일반 가족 템플릿만) */
  if (!age || age === "unknown") return false;
  if (age === "mixed") return true;
  return def.childAgeGroups.includes(age);
}

export function templatesForScenario(
  scenario: ScenarioType,
  childAgeGroup?: ChildAgeGroup
): CourseTemplateDefinition[] {
  return COURSE_TEMPLATE_CATALOG.filter(
    (t) => templateAppliesToScenario(t, scenario) && templateAppliesToChildAgeGroup(t, childAgeGroup)
  );
}

export function rankTemplatesForScenario(
  obj: ScenarioObject,
  config: ScenarioConfig,
  learningStore?: CourseLearningStore
): CourseTemplateDefinition[] {
  const list = templatesForScenario(obj.scenario, obj.childAgeGroup);
  const learn = (d: CourseTemplateDefinition) =>
    (learningStore ? computeTemplateSelectionLearnedBoost(learningStore, d, obj) : 0);
  return [...list].sort(
    (a, b) =>
      scoreTemplateSelection(b, obj, config) + learn(b) - (scoreTemplateSelection(a, obj, config) + learn(a))
  );
}

/** 데이트 3안 다양성: 활동형 / 감성·분위기 / 가벼운 동선 */
export function inferDateCourseKind(def: CourseTemplateDefinition): "activity" | "mood" | "light" {
  if (def.dateCourseKind) return def.dateCourseKind;
  if (def.steps.includes("ACTIVITY")) return "activity";
  if (def.movementLevel === "low" && def.steps.length <= 2) return "light";
  return "mood";
}

/** 코스 설명 한 줄 — 템플릿·동선·시간·시나리오 반영 */
export function buildNarrativeDescription(
  def: CourseTemplateDefinition,
  totalMinutes: number,
  totalTravelMin: number,
  walkHeavy: boolean,
  obj?: ScenarioObject
): string {
  const hours = Math.round(totalMinutes / 60);
  const timeHint = totalMinutes >= 300 ? "여유 있는 일정" : totalMinutes <= 150 ? "가볍게 도는 일정" : "현실적인 소요 시간";
  const sk = obj?.scenario;
  const age = obj?.childAgeGroup ?? "unknown";
  const wx = obj ? resolveWeatherCondition(obj) : "unknown";
  const dateBand = obj ? resolveDateTimeBand(obj) : "evening";

  if (sk === "date" && obj) {
    const wxLine =
      wx === "rainy" || wx === "bad_air"
        ? "비 오는 날에도 실내에서 편하게 즐길 수 있어요"
        : wx === "hot"
          ? "더운 날에도 실내 위주로 편한 흐름이에요"
          : wx === "cold"
            ? "추운 날 실내에서 이어가기 좋아요"
            : "";
    if (dateBand === "daytime") {
      return wxLine
        ? `가볍게 시작하기 좋은 데이트 코스예요 · ${wxLine} · ${timeHint}`
        : `가볍게 시작하기 좋은 데이트 코스예요 · ${timeHint}`;
    }
    if (dateBand === "evening") {
      return wxLine
        ? `식사 후 자연스럽게 이어지는 코스예요 · ${wxLine} · ${timeHint}`
        : `식사 후 자연스럽게 이어지는 코스예요 · ${timeHint}`;
    }
    if (dateBand === "night") {
      return wxLine
        ? `분위기 즐기기 좋은 밤 데이트 코스예요 · ${wxLine} · ${timeHint}`
        : `분위기 즐기기 좋은 밤 데이트 코스예요 · ${timeHint}`;
    }
  }

  if (
    sk === "family" ||
    sk === "family_kids" ||
    sk === "parent_child_outing"
  ) {
    const weatherPhrase =
      wx === "rainy"
        ? "비 오는 날에도 실내에서 편하게 도는 코스예요"
        : wx === "hot"
          ? "더운 날에도 무리 없이 다니기 좋아요 · 실내 위주로 편하게 짰어요"
          : wx === "cold" || wx === "bad_air"
            ? "날씨 영향 적게 움직일 수 있어요 · 따뜻한 실내 흐름이에요"
            : null;

    if (age === "toddler") {
      if (weatherPhrase) {
        return `${weatherPhrase} · 아이가 지치지 않게 짧게 도는 코스예요 · ${timeHint}`;
      }
      if (def.steps.includes("ACTIVITY") && def.steps.includes("FOOD")) {
        return `유아와 함께 움직이기 편한 코스예요 · 식사 후 바로 쉬지 않고 놀 수 있어요 · ${timeHint}`;
      }
    }
    if (age === "child") {
      if (weatherPhrase && wx !== "clear") {
        return `${weatherPhrase} · 초등생이 좋아할 활동형 코스예요 · ${timeHint}`;
      }
      if (def.steps.includes("ACTIVITY") && def.steps.includes("FOOD")) {
        return `초등생이 좋아할 활동형 코스예요 · 먹고 바로 뛰어놀기 좋아요 · ${timeHint}`;
      }
    }

    if (def.steps.includes("ACTIVITY") && def.steps.includes("FOOD")) {
      if (weatherPhrase && wx !== "clear") return `${weatherPhrase} · 식사 후 바로 활동하기 좋아요 · ${timeHint}`;
      return `식사 후 바로 활동하기 좋아요 · 움직임이 있는 가족 코스 · ${timeHint}`;
    }
    if (def.steps.includes("WALK")) {
      if (weatherPhrase) return `${weatherPhrase} · ${timeHint}`;
      return `식사 후 바깥에서 에너지 풀기 좋은 코스 · ${timeHint}`;
    }
    if (courseHasEnergyOrPlayStep(def.steps)) {
      return `아이가 지루하지 않게 구성했어요 · 부담 없이 즐길 수 있는 코스 · ${timeHint}`;
    }
    if (isFoodCafeOnly(def.steps)) {
      return `가볍게 이어가기 좋은 가족 동선 · ${timeHint}`;
    }
  }

  if (def.movementLevel === "high" || walkHeavy) {
    return `움직임이 있는 활동형 코스 · 약 ${hours}시간 분위기 · ${timeHint}`;
  }
  if (def.indoorPreference === "indoor" && !walkHeavy) {
    return `실내 위주로 편하게 이어지는 코스 · ${timeHint}`;
  }
  if (totalTravelMin <= 32) {
    return `가까운 동선으로 부담 적은 코스 · ${timeHint}`;
  }
  if (def.vibeTags.some((t) => /조용|대화/.test(t)) || def.steps.includes("CULTURE")) {
    return `조용하게 대화하기 좋은 흐름의 코스 · ${timeHint}`;
  }
  return `식사 후 가볍게 이어가기 좋은 코스 · 이동 약 ${totalTravelMin}분`;
}
