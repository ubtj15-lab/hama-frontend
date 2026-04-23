import type { HomeCard } from "@/lib/storeTypes";
import {
  businessScoreFromState,
  businessStateFromCard,
  distanceScoreFromKm,
  qualityScoreFromCard,
} from "@/lib/recommend/scoreParts";
import { haversineKm } from "./courseConstants";
import { mapPlaceToPlaceType } from "./placeTypeMap";
import { inferServingTypeForPlace, isDrinkOnlyForMealStep } from "./courseServingType";
import { childFriendlyScore } from "@/lib/recommend/childFriendlyScore";
import type { PlaceType, ScenarioConfig, ScenarioObject } from "./types";
import { courseHasEnergyOrPlayStep } from "./courseTemplateCatalog";
import {
  inferFamilyActivityType,
  isFamilyLikeScenario,
  resolveWeatherCondition,
} from "./familyCourseContext";
import { resolveDateTimeBand } from "./dateCourseContext";

/**
 * 단계 점수 가중치 (합 1.0) — rule-based, 학습은 별도 가산.
 * drink-only는 servingTimeFit에서 0에 가깝게 처리.
 */
export const STEP_SCORE_WEIGHTS = {
  categoryFit: 0.22,
  scenarioTagFit: 0.16,
  weatherFit: 0.06,
  distanceFit: 0.16,
  servingAndTimeFit: 0.12,
  moodTagFit: 0.07,
  qualityFit: 0.16,
  openStatusFit: 0.05,
  /** date/solo/family 등 시나리오 전용 보정은 가산(별도 블록) */
} as const;

/** 코스 추천에서 제외: 미용/금융/의료/부동산 등 */
export function isExcludedFromCoursePool(card: HomeCard): boolean {
  const c = String(card.category ?? "").toLowerCase();
  const hay = `${card.name ?? ""} ${c}`.toLowerCase();
  if (c === "salon") return true;
  if (/(?:은행|금융|대출|보험|증권)/.test(hay)) return true;
  if (/(?:병원|의원|치과|한의원|약국)/.test(hay)) return true;
  if (/(?:부동산|공인중개)/.test(hay)) return true;
  return false;
}

/** 전환 자연스러움 0~1 */
export function transitionNaturalness(a: PlaceType, b: PlaceType): number {
  const key = `${a}>${b}`;
  const table: Record<string, number> = {
    "FOOD>CAFE": 1,
    "FOOD>ACTIVITY": 0.95,
    "FOOD>WALK": 0.85,
    "FOOD>CULTURE": 0.75,
    "CAFE>FOOD": 0.88,
    "CAFE>ACTIVITY": 0.9,
    "CAFE>WALK": 0.92,
    "CAFE>CULTURE": 0.9,
    "ACTIVITY>CAFE": 0.95,
    "ACTIVITY>FOOD": 0.9,
    "ACTIVITY>WALK": 0.85,
    "WALK>CAFE": 0.95,
    "WALK>FOOD": 0.8,
    "CULTURE>CAFE": 0.95,
    "CULTURE>FOOD": 0.92,
    "CULTURE>ACTIVITY": 0.85,
  };
  return table[key] ?? 0.72;
}

/** 데이트: 분위기 가산 vs 가족·혼밥·회식 느낌 감점 */
function dateMoodAdjustment(card: HomeCard): number {
  const hay = `${card.name ?? ""} ${(card.tags ?? []).join(" ")} ${(card.mood ?? []).join(" ")}`.toLowerCase();
  let adj = 0;
  if (/(분위기|감성|로맨틱|조용|대화|야경|사진|인스타|포토|뷰)/.test(hay)) adj += 3;
  if (/(가족|키즈|유아|아이\s*동반)/.test(hay)) return -18;
  if (/(혼밥|1인\s*석|혼자\s*밥)/.test(hay)) return -16;
  if (/(회식|단체석|룸\s*코스|단체\s*예약)/.test(hay)) return -14;
  if (/(시끄|북적|클럽)/.test(hay)) return -10;
  return adj;
}

function scenarioTagFit(card: HomeCard, config: ScenarioConfig): number {
  const tags = [...(card.tags ?? []), ...(card.mood ?? [])].map((t) => String(t));
  const weights = config.tagWeights ?? {};
  let best = 0;
  for (const t of tags) {
    const w = weights[t as keyof typeof weights];
    if (typeof w === "number" && w > best) best = w;
  }
  return Math.min(100, best * 2.5);
}

/** 날씨·단계 유형 적합도 0~100 */
export function weatherFitScore(placeType: PlaceType, obj: ScenarioObject): number {
  const wx = resolveWeatherCondition(obj);
  if (wx === "clear") {
    if (placeType === "WALK") return 95;
    return 82;
  }
  if (wx === "rainy" || wx === "bad_air") {
    if (placeType === "WALK") return 22;
    if (placeType === "ACTIVITY") return 68;
    if (placeType === "FOOD" || placeType === "CAFE") return 78;
    return 72;
  }
  if (wx === "hot" || wx === "cold") {
    if (placeType === "WALK") return 45;
    return 70;
  }
  return 75;
}

/** 혼밥·가성비·부담 없음 등 솔로 적합도 0~100 */
export function soloFriendlyScore(card: HomeCard, stepType: PlaceType): number {
  const hay = `${card.name ?? ""} ${(card.tags ?? []).join(" ")} ${(card.mood ?? []).join(" ")}`.toLowerCase();
  let s = 58;
  if (stepType === "FOOD" || stepType === "CAFE") {
    if (/(가성비|합리|빠른|간단|1인|혼밥|부담|가벼운|캐주얼)/.test(hay)) s += 28;
    if (/(단체|룸|회식|예식)/.test(hay)) s -= 32;
  }
  return Math.min(100, Math.max(0, s));
}

function timeOfDayFit(placeType: PlaceType, obj: ScenarioObject): number {
  const tod = obj.timeOfDay;
  if (!tod) return 70;
  if (placeType === "FOOD") {
    if (tod === "lunch" || tod === "dinner") return 95;
    if (tod === "afternoon") return 72;
    return 78;
  }
  if (placeType === "CAFE") {
    if (tod === "afternoon" || tod === "morning") return 92;
    if (tod === "night") return 88;
    return 80;
  }
  if (placeType === "WALK") {
    if (tod === "afternoon" || tod === "morning") return 90;
    if (tod === "night") return 55;
    return 75;
  }
  return 75;
}

function servingTimeFit(card: HomeCard, stepType: PlaceType, obj: ScenarioObject): number {
  const st = inferServingTypeForPlace(card, stepType);
  if (stepType === "FOOD" && isDrinkOnlyForMealStep(card, stepType)) return 0;
  if (obj.mealRequired && stepType === "FOOD" && st === "drink") return 15;
  if (obj.scenario === "solo" && stepType === "FOOD" && st === "drink") return 20;
  if (st === "meal" && stepType === "FOOD") return 95;
  if (st === "drink" && stepType === "CAFE") return 95;
  return 78;
}

export type StepScoreContext = {
  prev: HomeCard | null;
  stepType: PlaceType;
  stepIndex: number;
  obj: ScenarioObject;
  config: ScenarioConfig;
  nearOnly: boolean;
};

/**
 * 단계 후보 점수 0~100 — `STEP_SCORE_WEIGHTS` 기반 rule + 시나리오 보정.
 */
export function computeStepScore(card: HomeCard, ctx: StepScoreContext): number {
  const mapped = mapPlaceToPlaceType(card);
  const categoryFit = mapped === ctx.stepType ? 100 : mapped === "FOOD" && ctx.stepType === "CAFE" ? 45 : 35;

  let scenarioTag = scenarioTagFit(card, ctx.config);
  if (ctx.obj.scenario === "solo" && (ctx.stepType === "FOOD" || ctx.stepType === "CAFE")) {
    scenarioTag = Math.min(100, (scenarioTag * 0.55 + soloFriendlyScore(card, ctx.stepType) * 0.45));
  }

  const wxFit = weatherFitScore(ctx.stepType, ctx.obj);

  let distanceFit = 85;
  if (ctx.prev) {
    const km = haversineKm(ctx.prev, card);
    if (km != null) {
      distanceFit = distanceScoreFromKm(km);
      if (ctx.nearOnly && km > 3) distanceFit *= 0.35;
      else if (km > 6) distanceFit *= 0.5;
      if (km > 8) distanceFit *= 0.72;
    }
  }

  const stFit = servingTimeFit(card, ctx.stepType, ctx.obj);
  const todFit = timeOfDayFit(ctx.stepType, ctx.obj);
  const servingAndTime = (stFit + todFit) / 2;

  const q = qualityScoreFromCard(card) / 100;
  const biz = businessScoreFromState(businessStateFromCard(card)) / 100;

  const moodHay = [...(card.mood ?? []), ...(card.tags ?? [])].join(" ");
  const moodFit = moodHay.length > 0 ? 72 : 55;

  const w = STEP_SCORE_WEIGHTS;
  const raw =
    categoryFit * w.categoryFit +
    scenarioTag * w.scenarioTagFit +
    wxFit * w.weatherFit +
    distanceFit * w.distanceFit +
    servingAndTime * w.servingAndTimeFit +
    moodFit * w.moodTagFit +
    (q * 100) * w.qualityFit +
    biz * 100 * w.openStatusFit;

  let out = Math.max(0, Math.min(100, Math.round(raw)));
  const sk = ctx.obj.scenario;
  if (
    (sk === "family_kids" || sk === "parent_child_outing") &&
    (ctx.stepType === "FOOD" || ctx.stepType === "CAFE")
  ) {
    out = Math.min(100, Math.round(out + childFriendlyScore(card) * 10));
  }
  if (
    (sk === "family" || sk === "family_kids" || sk === "parent_child_outing") &&
    ctx.stepType === "ACTIVITY"
  ) {
    out = Math.min(100, Math.round(out + childFriendlyScore(card) * 12));
  }

  if (sk === "date") {
    out = Math.max(0, Math.min(100, Math.round(out + dateMoodAdjustment(card))));
  }

  if (isFamilyLikeScenario(sk)) {
    const wx = resolveWeatherCondition(ctx.obj);
    const badWx = wx === "rainy" || wx === "hot" || wx === "cold" || wx === "bad_air";
    const age = ctx.obj.childAgeGroup ?? "unknown";
    const fat = inferFamilyActivityType(card);

    if (ctx.stepType === "WALK" && badWx) {
      out = Math.max(0, Math.round(out - (age === "toddler" ? 28 : 20)));
    }
    if (ctx.stepType === "ACTIVITY") {
      if (badWx && fat === "kids_outdoor") {
        out = Math.max(0, Math.round(out - 22));
      }
      if (badWx && (fat === "kids_indoor" || fat === "learning" || fat === "active_play")) {
        out = Math.min(100, Math.round(out + 12));
      }
      if (age === "toddler") {
        if (fat === "kids_indoor" || fat === "mixed_family") out = Math.min(100, Math.round(out + 10));
        if (fat === "active_play") out = Math.max(0, Math.round(out - 6));
      }
      if (age === "child") {
        if (fat === "active_play" || fat === "learning") out = Math.min(100, Math.round(out + 8));
        if (fat === "quiet_rest") out = Math.max(0, Math.round(out - 10));
        if (!badWx && fat === "kids_outdoor") out = Math.min(100, Math.round(out + 6));
      }
      if ((age === "mixed" || age === "unknown") && (fat === "kids_indoor" || fat === "mixed_family")) {
        out = Math.min(100, Math.round(out + 6));
      }
    }
    if (age === "toddler" && ctx.prev && ctx.stepIndex > 0) {
      const km = haversineKm(ctx.prev, card);
      if (km != null && km > 2.5) out = Math.max(0, Math.round(out * 0.88));
    }
  }

  return out;
}

export function averageTransitionScore(template: PlaceType[]): number {
  if (template.length < 2) return 0.85;
  let s = 0;
  let n = 0;
  for (let i = 0; i < template.length - 1; i++) {
    s += transitionNaturalness(template[i]!, template[i + 1]!);
    n++;
  }
  return n ? s / n : 0.85;
}

/** 왕복·비효율 동선 감지: 전체 경로 km / (첫~끝 직선) 비율 */
export function routeEfficiencyScore(cards: HomeCard[]): number {
  if (cards.length < 2) return 90;
  let pathKm = 0;
  for (let i = 0; i < cards.length - 1; i++) {
    const km = haversineKm(cards[i]!, cards[i + 1]!);
    if (km != null) pathKm += km;
  }
  const direct = haversineKm(cards[0]!, cards[cards.length - 1]!);
  if (direct == null || direct < 0.05) return 80;
  const ratio = pathKm / (direct + 0.01);
  if (ratio <= 1.8) return 95;
  if (ratio <= 2.5) return 75;
  if (ratio <= 3.5) return 55;
  return 30;
}

function duplicateCategoryPenalty(cards: HomeCard[]): number {
  const cats = cards.map((c) => String(c.category ?? "").toLowerCase());
  const set = new Set(cats);
  return set.size === cats.length ? 0 : 18;
}

function durationFitScore(totalMinutes: number, targetHours?: number): number {
  if (targetHours == null || !Number.isFinite(targetHours)) return 85;
  const target = targetHours * 60;
  const diff = Math.abs(totalMinutes - target);
  if (diff <= 45) return 100;
  if (diff <= 90) return 85;
  if (diff <= 150) return 70;
  return 50;
}

/**
 * Rule 기반 코스 총점 0~100 + `learnedBoost` 가산(상한).
 * 구성: 전환 자연스러움·동선 효율·체류 시간 적합·업종 중복 회피·이동 패널티 + 시나리오 보정.
 */
export function computeCourseScore(
  cards: HomeCard[],
  template: PlaceType[],
  obj: ScenarioObject,
  config: ScenarioConfig,
  totalMinutes: number,
  totalTravelMin: number,
  /** 통계 기반 학습 보정 (0~12 권장, 상한은 호출부에서도 clamp) */
  learnedBoost?: number
): number {
  if (cards.length !== template.length) return 0;
  const trans = averageTransitionScore(template) * 100;
  const route = routeEfficiencyScore(cards);
  const dup = duplicateCategoryPenalty(cards);
  const dur = durationFitScore(totalMinutes, config.defaultDurationHours);
  const travelPenalty = totalTravelMin > 55 ? Math.min(25, (totalTravelMin - 55) * 0.4) : 0;

  let base = trans * 0.28 + route * 0.22 + dur * 0.2 + (100 - dup) * 0.15;
  const sk = obj.scenario;
  if (sk === "date") {
    const wx = resolveWeatherCondition(obj);
    const band = obj.dateTimeBand ?? resolveDateTimeBand(obj);
    if ((wx === "rainy" || wx === "bad_air") && template.includes("WALK")) base -= 14;
    if (band === "evening" && template[0] === "FOOD" && template.includes("CAFE")) base += 5;
    if (wx === "clear" && template.includes("WALK") && band === "daytime") base += 4;
  }
  if (
    sk === "family" ||
    sk === "family_kids" ||
    sk === "parent_child_outing"
  ) {
    if (courseHasEnergyOrPlayStep(template)) base += 8;
    if (!courseHasEnergyOrPlayStep(template) && template.length <= 2) base *= 0.72;
    const wx = resolveWeatherCondition(obj);
    const badWx = wx === "rainy" || wx === "hot" || wx === "cold" || wx === "bad_air";
    const age = obj.childAgeGroup ?? "unknown";
    if (badWx && template.includes("WALK")) base -= 12;
    if (age === "toddler" && totalTravelMin > 48) base -= 10;
    if (age === "toddler" && totalMinutes > 220) base -= 8;
    if (age === "child" && template.includes("CAFE") && !courseHasEnergyOrPlayStep(template)) {
      base -= 8;
    }
    if (
      sk === "family" &&
      template.length === 2 &&
      template[0] === "FOOD" &&
      template[1] === "CAFE"
    ) {
      base *= 0.5;
    }
    if (
      (sk === "family_kids" || sk === "parent_child_outing") &&
      template.length === 2 &&
      template[0] === "FOOD" &&
      template[1] === "CAFE"
    ) {
      base *= 0.62;
    }
  }
  const travelFit = Math.max(0, 100 - travelPenalty);
  let combined = base * 0.85 + travelFit * 0.15;

  /** 1단계 예약 가능 시 약한 가산(실행 일정 연결) */
  const first = cards[0];
  if (first && (first as { reservation_required?: boolean | null }).reservation_required === true) {
    combined = Math.min(100, combined + 2);
  }

  if (sk === "solo" && totalMinutes > 200) combined = Math.max(0, combined - 6);
  if (sk === "date" && (obj.dateTimeBand ?? resolveDateTimeBand(obj)) === "night" && totalMinutes > 300) {
    combined = Math.max(0, combined - 8);
  }

  if (learnedBoost != null && learnedBoost !== 0) {
    combined = Math.max(0, Math.min(100, combined + learnedBoost));
  }
  return Math.max(0, Math.min(100, Math.round(combined)));
}
