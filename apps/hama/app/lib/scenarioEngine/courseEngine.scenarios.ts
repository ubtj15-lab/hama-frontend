import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { computeLearnedBoosts } from "@/lib/courseLearning/courseLearningBoost";
import { generateCourses } from "./courseEngine";
import { resolveScenarioConfig } from "./resolveScenarioConfig";
import { resolveDateTimeBand } from "./dateCourseContext";
import { isDrinkOnlyForMealStep } from "./courseServingType";
import {
  buildNarrativeDescription,
  COURSE_TEMPLATE_CATALOG,
  courseHasEnergyOrPlayStep,
  rankTemplatesForScenario,
  scoreTemplateSelection,
  type CourseTemplateDefinition,
} from "./courseTemplateCatalog";
import { CourseLearningStore } from "@/lib/courseLearning/courseLearningStore";
import { parseScenarioIntent } from "./intentClassification";
import { SCENARIO_CONFIGS } from "./scenarioConfigs";
import type { ScenarioObject } from "./types";

function card(id: string, category: string, name?: string): HomeCard {
  return { id, name: name ?? id, category };
}

/**
 * 코스 엔진 표준 시나리오(수동/CI에서 import 후 실행 가능).
 * 실패 설명 문자열 배열을 반환하며, 배열이 비면 통과.
 */
export function runCourseEngineScenarioChecks(): string[] {
  const failures: string[] = [];
  const obj: ScenarioObject = {
    intentType: "course_generation",
    scenario: "date",
    rawQuery: "데이트 코스",
    confidence: 0.9,
  };
  const cfg = resolveScenarioConfig(obj);

  const mixed = [
    card("r1", "restaurant"),
    card("r2", "restaurant"),
    card("c1", "cafe"),
    card("c2", "cafe"),
    card("a1", "activity"),
    card("a2", "activity"),
  ];

  const tabs: HomeTabKey[] = ["all", "restaurant", "cafe", "salon", "activity"];
  for (const homeTab of tabs) {
    const plans = generateCourses(mixed, obj, cfg, 8, { homeTab });
    for (const plan of plans) {
      for (const stop of plan.stops) {
        const lab = String(stop.categoryLabel ?? "").toLowerCase();
        if (lab === "salon") failures.push(`tab=${homeTab}: unexpected salon in ${plan.id}`);
      }
      const tpl = plan.template;
      if (tpl.length !== plan.stops.length) {
        failures.push(`tab=${homeTab}: template/stops length mismatch`);
        continue;
      }
      for (let i = 0; i < tpl.length; i++) {
        if (plan.stops[i]!.placeType !== tpl[i]) {
          failures.push(
            `tab=${homeTab}: stop ${i} placeType ${plan.stops[i]!.placeType} !== template ${tpl[i]}`
          );
        }
      }
      const ids = plan.stops.map((s) => s.placeId);
      if (new Set(ids).size < ids.length) {
        failures.push(`tab=${homeTab}: duplicate place in one course`);
      }
    }
  }

  const withNonSalon = [card("s1", "salon"), card("s2", "salon"), card("r1", "restaurant")];
  const beautyTabPlans = generateCourses(withNonSalon, obj, cfg, 2, { homeTab: "salon" });
  if (
    beautyTabPlans.some((p) =>
      p.stops.some((s) => String(s.categoryLabel ?? "").toLowerCase() === "salon")
    )
  ) {
    failures.push("salon tab: course stops must not include beauty when non-salon exists in pool");
  }

  if (generateCourses([card("s1", "salon")], obj, cfg, 2, { homeTab: "salon" }).length !== 0) {
    failures.push("salon-only pool should yield zero course plans");
  }

  return failures;
}

/**
 * 가족 코스: 식당→카페 단독 금지, 활동·산책·체험 단계 포함 검증.
 */
export function runFamilyCourseTemplateChecks(): string[] {
  const failures: string[] = [];

  const familyObj: ScenarioObject = {
    intentType: "course_generation",
    scenario: "family",
    rawQuery: "가족 외식",
    confidence: 0.85,
  };
  const badTwoStep: CourseTemplateDefinition = {
    id: "test-food-cafe-family",
    scenarios: ["family"],
    steps: ["FOOD", "CAFE"],
    movementLevel: "low",
    indoorPreference: "mixed",
    durationMinMinutes: 90,
    durationMaxMinutes: 150,
    vibeTags: [],
  };
  if (scoreTemplateSelection(badTwoStep, familyObj, SCENARIO_CONFIGS.family) > -50) {
    failures.push("family: FOOD+CAFE only template must score below -50");
  }

  const famCfg = resolveScenarioConfig(familyObj);
  const famPool: HomeCard[] = [
    card("fr1", "restaurant", "식당"),
    card("fc1", "cafe", "카페"),
    card("fa1", "activity", "놀이공간"),
  ];
  const famPlans = generateCourses(famPool, familyObj, famCfg, 3);
  for (const p of famPlans) {
    if (!courseHasEnergyOrPlayStep(p.template)) {
      failures.push(`family scenario course must include ACTIVITY/WALK/CULTURE, got ${p.template.join("→")}`);
    }
  }

  return failures;
}

/**
 * 데이트: 시간대(dateTimeBand)·날씨 기반 템플릿·추론 검증.
 */
export function runDateCourseTimeWeatherChecks(): string[] {
  const failures: string[] = [];
  const cfg = SCENARIO_CONFIGS.date;

  const afternoon = parseScenarioIntent("데이트 오후 2시");
  if (afternoon.scenario !== "date") failures.push("parse: 데이트 오후 2시 → scenario date");
  if (resolveDateTimeBand(afternoon) !== "daytime") {
    failures.push(`date band: 오후 2시 → daytime, got ${resolveDateTimeBand(afternoon)}`);
  }

  const eve = parseScenarioIntent("데이트 오후 7시");
  if (resolveDateTimeBand(eve) !== "evening") {
    failures.push(`date band: 오후 7시 → evening, got ${resolveDateTimeBand(eve)}`);
  }

  const nightQ = parseScenarioIntent("데이트 밤 10시");
  if (resolveDateTimeBand(nightQ) !== "night") {
    failures.push(`date band: 밤 10시 → night, got ${resolveDateTimeBand(nightQ)}`);
  }

  const rainy: ScenarioObject = {
    intentType: "course_generation",
    scenario: "date",
    rawQuery: "데이트 비 오는 날",
    weatherCondition: "rainy",
    confidence: 0.9,
  };
  const ranked = rankTemplatesForScenario(rainy, cfg);
  if (ranked[0]?.steps.includes("WALK")) {
    failures.push("date rainy: top-ranked template should not center on WALK");
  }
  const walkTpl = ranked.find((t) => t.id === "date-food-cafe-walk");
  const indoorTpl = ranked.find((t) => t.id === "date-eve-food-activity-cafe");
  if (walkTpl && indoorTpl && scoreTemplateSelection(walkTpl, rainy, cfg) > scoreTemplateSelection(indoorTpl, rainy, cfg)) {
    failures.push("date rainy: walk template should not beat indoor-leaning template");
  }

  return failures;
}

/**
 * 가족 코스: 연령대(childAgeGroup)·날씨(weatherCondition) 템플릿 순위·설명 문구 검증.
 */
export function runFamilyCourseWeatherAgeChecks(): string[] {
  const failures: string[] = [];
  const famCfg = SCENARIO_CONFIGS.family;

  const rainyToddler: ScenarioObject = {
    intentType: "course_generation",
    scenario: "family",
    rawQuery: "유모차 아기랑 비 오는 날",
    childAgeGroup: "toddler",
    weatherCondition: "rainy",
    confidence: 0.9,
  };
  const rankedRainy = rankTemplatesForScenario(rainyToddler, famCfg);
  const topRainy = rankedRainy[0];
  if (topRainy?.steps.includes("WALK")) {
    failures.push("family toddler+rainy: top template must not be WALK-centric");
  }
  const walkDef = rankedRainy.find((t) => t.id === "family-food-walk-cafe");
  if (walkDef && topRainy) {
    if (scoreTemplateSelection(walkDef, rainyToddler, famCfg) > scoreTemplateSelection(topRainy, rainyToddler, famCfg)) {
      failures.push("family toddler+rainy: walk template must not outrank top");
    }
  }

  const clearChild: ScenarioObject = {
    intentType: "course_generation",
    scenario: "family",
    rawQuery: "초등 아이 맑은 날 나들이",
    childAgeGroup: "child",
    weatherCondition: "clear",
    confidence: 0.9,
  };
  const rankedClear = rankTemplatesForScenario(clearChild, famCfg);
  const walkTpl = rankedClear.find((t) => t.id === "family-food-walk-cafe");
  const foodActTpl = rankedClear.find((t) => t.id === "family-food-activity");
  if (walkTpl && foodActTpl) {
    if (scoreTemplateSelection(walkTpl, clearChild, famCfg) < scoreTemplateSelection(foodActTpl, clearChild, famCfg) - 45) {
      failures.push("family child+clear: walk template should not trail food→activity by a huge margin");
    }
  }

  const hotToddler: ScenarioObject = {
    intentType: "course_generation",
    scenario: "family",
    rawQuery: "더운 날 유아 외출",
    childAgeGroup: "toddler",
    weatherCondition: "hot",
    confidence: 0.9,
  };
  const rankedHot = rankTemplatesForScenario(hotToddler, famCfg);
  if (rankedHot[0]?.steps.includes("WALK")) {
    failures.push("family toddler+hot: top template must not prioritize WALK");
  }

  const desc = buildNarrativeDescription(
    rankedRainy.find((t) => t.steps.includes("ACTIVITY") && t.steps.includes("FOOD")) ?? rankedRainy[0]!,
    180,
    20,
    false,
    rainyToddler
  );
  if (!/(비|실내|편하게)/.test(desc)) {
    failures.push("family narrative: rainy should mention indoor or rain-friendly copy");
  }

  return failures;
}

/** 유아 + 비: 실내 식사→액티비티가 공원 산책형보다 높은 점수 */
export function runToddlerRainyIndoorPreferenceChecks(): string[] {
  const failures: string[] = [];
  const famCfg = SCENARIO_CONFIGS.family;
  const rainyToddler: ScenarioObject = {
    intentType: "course_generation",
    scenario: "family",
    rawQuery: "유모차 아기",
    childAgeGroup: "toddler",
    weatherCondition: "rainy",
    confidence: 0.9,
  };
  const tAct = COURSE_TEMPLATE_CATALOG.find((t) => t.id === "toddler-food-activity");
  const tWalk = COURSE_TEMPLATE_CATALOG.find((t) => t.id === "toddler-food-walk");
  if (
    tAct &&
    tWalk &&
    scoreTemplateSelection(tWalk, rainyToddler, famCfg) >= scoreTemplateSelection(tAct, rainyToddler, famCfg)
  ) {
    failures.push("toddler+rainy: indoor food→activity should score above food→walk");
  }
  return failures;
}

/** 저녁 데이트: evening 전용 식당→카페 템플릿이 낮 브런치형보다 우선 */
export function runDateEveningRestaurantCafeChecks(): string[] {
  const failures: string[] = [];
  const cfg = SCENARIO_CONFIGS.date;
  const dateEve: ScenarioObject = {
    intentType: "course_generation",
    scenario: "date",
    rawQuery: "저녁 데이트",
    timeOfDay: "dinner",
    confidence: 0.9,
  };
  if (resolveDateTimeBand(dateEve) !== "evening") {
    failures.push("date evening: expected dateTimeBand evening");
  }
  const eveCafe = COURSE_TEMPLATE_CATALOG.find((t) => t.id === "date-eve-food-cafe");
  const dayBrunch = COURSE_TEMPLATE_CATALOG.find((t) => t.id === "date-day-brunch-cafe-walk");
  if (
    eveCafe &&
    dayBrunch &&
    scoreTemplateSelection(eveCafe, dateEve, cfg) <= scoreTemplateSelection(dayBrunch, dateEve, cfg)
  ) {
    failures.push("date evening: date-eve-food-cafe should beat daytime brunch template score");
  }
  return failures;
}

/**
 * 테스트 1 — date + evening + clear: 식당→카페 흐름·현실적 총 소요.
 */
export function runDateEveningClearPipelineChecks(): string[] {
  const failures: string[] = [];
  const cfg = SCENARIO_CONFIGS.date;
  const obj: ScenarioObject = {
    intentType: "course_generation",
    scenario: "date",
    rawQuery: "맑은 저녁 데이트",
    timeOfDay: "dinner",
    weatherCondition: "clear",
    confidence: 0.9,
  };
  if (resolveDateTimeBand(obj) !== "evening") {
    failures.push("date evening clear: expected dateTimeBand evening");
  }
  const pool: HomeCard[] = [
    {
      id: "r1",
      name: "분위기 한식",
      category: "restaurant",
      lat: 37.5,
      lng: 127.0,
      tags: ["분위기", "데이트"],
      mood: ["감성"],
    },
    { id: "c1", name: "루프탑 카페", category: "cafe", lat: 37.5001, lng: 127.0001, tags: ["야경"] },
    { id: "r2", name: "파스타", category: "restaurant", lat: 37.5, lng: 127.0 },
    { id: "c2", name: "디저트", category: "cafe", lat: 37.5002, lng: 127.0002 },
    { id: "a1", name: "전시", category: "activity", lat: 37.5003, lng: 127.0003 },
  ];
  const plans = generateCourses(pool, obj, cfg, 3);
  if (plans.length === 0) {
    failures.push("date evening clear: expected at least one course plan");
    return failures;
  }
  const first = plans[0]!;
  if (first.totalMinutes < 90 || first.totalMinutes > 480) {
    failures.push(`date evening clear: totalMinutes ${first.totalMinutes} should be roughly 90–480`);
  }
  const foodIdx = first.template.indexOf("FOOD");
  const cafeIdx = first.template.indexOf("CAFE");
  if (foodIdx < 0 || cafeIdx < 0 || foodIdx >= cafeIdx) {
    failures.push(
      `date evening clear: expected FOOD before CAFE in template, got ${first.template.join("→")}`
    );
  }
  return failures;
}

/**
 * 테스트 2 — family_kids + toddler + rainy: 실내·액티비티 우선, 산책형에 밀리지 않음.
 */
export function runFamilyKidsToddlerRainyPipelineChecks(): string[] {
  const failures: string[] = [];
  const famCfg = SCENARIO_CONFIGS.family_kids;
  const rainyToddler: ScenarioObject = {
    intentType: "course_generation",
    scenario: "family_kids",
    rawQuery: "유모차 아기랑 비 오는 날",
    childAgeGroup: "toddler",
    weatherCondition: "rainy",
    confidence: 0.9,
  };
  const rankedRainy = rankTemplatesForScenario(rainyToddler, famCfg);
  const topRainy = rankedRainy[0];
  if (topRainy?.steps.includes("WALK")) {
    failures.push("family_kids toddler+rainy: top template must not be WALK-centric");
  }
  const tAct = COURSE_TEMPLATE_CATALOG.find((t) => t.id === "toddler-food-activity");
  const tWalk = COURSE_TEMPLATE_CATALOG.find((t) => t.id === "toddler-food-walk");
  if (
    tAct &&
    tWalk &&
    scoreTemplateSelection(tWalk, rainyToddler, famCfg) >= scoreTemplateSelection(tAct, rainyToddler, famCfg)
  ) {
    failures.push("family_kids toddler+rainy: food→activity should beat food→walk");
  }
  const pool: HomeCard[] = [
    { id: "fr1", name: "키즈 메뉴 식당", category: "restaurant", lat: 37.4, lng: 126.9, tags: ["아이동반"] },
    { id: "fa1", name: "실내 키즈카페", category: "activity", lat: 37.4001, lng: 126.9001, tags: ["실내"] },
    { id: "fc1", name: "디저트", category: "cafe", lat: 37.4002, lng: 126.9002 },
  ];
  const plans = generateCourses(pool, rainyToddler, famCfg, 3);
  for (const p of plans) {
    if (p.totalMinutes > 360) {
      failures.push(`family_kids toddler+rainy: course too long (${p.totalMinutes}m)`);
    }
    const travel = p.stops.reduce((s, x) => s + (x.travelMinutesToNext ?? 0), 0);
    if (travel > 120) {
      failures.push(`family_kids toddler+rainy: travel sum too high (${travel}m)`);
    }
  }
  return failures;
}

/**
 * 테스트 3 — solo + lunch + mealRequired: 식사 단계에 drink-only 불가.
 */
export function runSoloLunchNoDrinkOnlyMealChecks(): string[] {
  const failures: string[] = [];
  const soloCfg = SCENARIO_CONFIGS.solo;
  const soloLunch: ScenarioObject = {
    intentType: "course_generation",
    scenario: "solo",
    rawQuery: "점심 혼밥",
    timeOfDay: "lunch",
    mealRequired: true,
    confidence: 0.9,
  };
  const pool: HomeCard[] = [
    { id: "drinkOnly", name: "베이커리 카페", category: "restaurant", tags: ["베이커리", "커피"] },
    { id: "mealOk", name: "한식 점심", category: "restaurant", tags: ["한식", "점심"] },
    { id: "cafe1", name: "에스프레소", category: "cafe", tags: ["혼밥"] },
  ];
  const plans = generateCourses(pool, soloLunch, soloCfg, 3);
  for (const p of plans) {
    for (const st of p.stops) {
      if (st.placeType !== "FOOD") continue;
      const card = pool.find((c) => c.id === st.placeId);
      if (card && isDrinkOnlyForMealStep(card, "FOOD")) {
        failures.push(`solo lunch: FOOD step must not be drink-only (${st.placeName})`);
      }
    }
    if (p.totalMinutes > 300) {
      failures.push(`solo lunch: prefer shorter course, got ${p.totalMinutes}m`);
    }
  }
  return failures;
}

/**
 * 테스트 5 — 노출 수 적음: learned boost 거의 0 (rule 유지).
 */
export function runLowImpressionsLearnedBoostNearZeroChecks(): string[] {
  const failures: string[] = [];
  const store = new CourseLearningStore();
  const payload = {
    courseId: "c1",
    templateId: "date-eve-food-cafe",
    scenario: "date" as const,
    stepCategories: ["FOOD", "CAFE"] as const,
    placeIds: ["p1", "p2"],
  };
  for (let i = 0; i < 2; i++) {
    store.recordEvent("course_impression", payload as any);
  }
  const obj: ScenarioObject = {
    intentType: "course_generation",
    scenario: "date",
    rawQuery: "저녁 데이트",
    timeOfDay: "dinner",
    confidence: 0.9,
  };
  const cards: HomeCard[] = [
    { id: "p1", name: "식당", category: "restaurant" },
    { id: "p2", name: "카페", category: "cafe" },
  ];
  const boost = computeLearnedBoosts(store, {
    obj,
    templateId: "date-eve-food-cafe",
    steps: ["FOOD", "CAFE"],
    placeIds: ["p1", "p2"],
    totalTravelMin: 12,
    def: {
      id: "date-eve-food-cafe",
      steps: ["FOOD", "CAFE"],
      indoorPreference: "mixed",
      movementLevel: "medium",
      vibeTags: ["데이트"],
    },
    cards,
  });
  if (boost.total > 0.5) {
    failures.push(`low impressions: learned boost should be ~0, got ${boost.total}`);
  }
  return failures;
}

/** 노출·출발 로그가 쌓이면 동일 템플릿 선택 순위가 악화되지 않음 */
export function runLearningBoostRankImprovesChecks(): string[] {
  const failures: string[] = [];
  const obj: ScenarioObject = {
    intentType: "course_generation",
    scenario: "date",
    rawQuery: "저녁 데이트",
    timeOfDay: "dinner",
    confidence: 0.9,
  };
  const cfg = SCENARIO_CONFIGS.date;
  const store = new CourseLearningStore();
  const payload = {
    courseId: "c1",
    templateId: "date-eve-food-cafe",
    scenario: "date" as const,
    stepCategories: ["FOOD", "CAFE"] as const,
    placeIds: ["p1", "p2"],
  };
  for (let i = 0; i < 25; i++) {
    store.recordEvent("course_impression", payload as any);
  }
  for (let i = 0; i < 10; i++) {
    store.recordEvent("course_start_click", payload as any);
  }
  const withBoost = rankTemplatesForScenario(obj, cfg, store);
  const plain = rankTemplatesForScenario(obj, cfg, undefined);
  const idxLearn = withBoost.findIndex((t) => t.id === "date-eve-food-cafe");
  const idxPlain = plain.findIndex((t) => t.id === "date-eve-food-cafe");
  if (idxLearn > idxPlain) {
    failures.push(`learning: rank of date-eve-food-cafe should not worsen (learn=${idxLearn} plain=${idxPlain})`);
  }
  return failures;
}

/** toddler·날씨·저녁 데이트·학습 부스트 통합 검증 */
export function runAdvancedCourseEngineChecks(): string[] {
  return [
    ...runToddlerRainyIndoorPreferenceChecks(),
    ...runDateEveningRestaurantCafeChecks(),
    ...runLearningBoostRankImprovesChecks(),
  ];
}
