import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { businessStateFromCard, qualityScoreFromCard } from "@/lib/recommend/scoreParts";
import {
  dwellMinutesForPlace,
  estimateTravelMinutes,
} from "./courseConstants";
import { mapPlaceToPlaceType } from "./placeTypeMap";
import type { ScenarioConfig, ScenarioObject, PlaceType, CoursePlan, CourseStop, ScenarioType } from "./types";
import { buildCourseBadges, buildFunctionalCourseTitle, buildSituationCourseTitle } from "./coursePresentation";
import { snapshotHomeCardForCourse } from "@/lib/course/courseCardSnapshot";
import { computeLearnedBoosts } from "@/lib/courseLearning/courseLearningBoost";
import { buildPatternKey, contextFromScenarioObject, stepPatternFromSteps } from "@/lib/courseLearning/courseLearningKeys";
import { getPatternBoostFromMap } from "@/lib/recommend/getPatternBoost";
import type { LearnedBoostParts } from "@/lib/courseLearning/courseLearningTypes";
import type { CourseLearningStore } from "@/lib/courseLearning/courseLearningStore";
import { resolveDateTimeBand, defaultStartTimeForDateBand } from "./dateCourseContext";
import {
  rankTemplatesForScenario,
  scoreTemplateSelection,
  inferDateCourseKind,
  type CourseTemplateDefinition,
  buildNarrativeDescription,
} from "./courseTemplateCatalog";
import {
  computeCourseScore,
  computeStepScore,
  isExcludedFromCoursePool,
  type StepScoreContext,
} from "./courseScoring";
import { inferServingTypeForPlace, servingOkForStep } from "./courseServingType";
import { isHardExcludedForKidsScenario } from "@/lib/recommend/childFriendlyScore";
import { familyKidsBeamStepRejects } from "@/lib/recommend/placeFamilyClassification";
import { scenarioCourseFlowBias } from "@/lib/recommend/scenarioForcedRules";

const TAB_CATEGORY_BOOST = 25;
const BEAM_WIDTH = 10;
const TOP_BRANCH = 14;
const MAX_TEMPLATES_TRY = 12;

function tabCategoryBoost(p: HomeCard, tab: HomeTabKey): number {
  if (tab === "all" || tab === "salon") return 0;
  const c = String(p.category ?? "").toLowerCase();
  if (tab === "restaurant" && c === "restaurant") return TAB_CATEGORY_BOOST;
  if (tab === "cafe" && c === "cafe") return TAB_CATEGORY_BOOST;
  if (tab === "activity" && c === "activity") return TAB_CATEGORY_BOOST;
  return 0;
}

function mainCategory(p: HomeCard): string {
  const c = String(p.category ?? "").toLowerCase();
  return c || "_none";
}

function brandPrefix(name: string): string | null {
  const first = String(name).trim().split(/[\s|,.]+/)[0] ?? "";
  return first.length >= 2 ? first.toLowerCase() : null;
}

function fallbackOrderForStep(step: PlaceType): PlaceType[] {
  switch (step) {
    case "FOOD":
      return ["CAFE", "ACTIVITY", "CULTURE", "WALK"];
    case "CAFE":
      return ["FOOD", "ACTIVITY", "CULTURE", "WALK"];
    case "ACTIVITY":
      return ["CULTURE", "FOOD", "CAFE", "WALK"];
    case "CULTURE":
      return ["ACTIVITY", "FOOD", "CAFE", "WALK"];
    case "WALK":
      return ["ACTIVITY", "CULTURE", "FOOD", "CAFE"];
    default:
      return ["FOOD", "CAFE", "ACTIVITY", "CULTURE", "WALK"];
  }
}

export type CandidatesByType = Record<PlaceType, HomeCard[]>;

export function collectCandidatesByType(
  places: HomeCard[],
  config: ScenarioConfig,
  opts: { maxPerType?: number; homeTab?: HomeTabKey } = {}
): CandidatesByType {
  const maxPer = opts.maxPerType ?? 24;
  const homeTab = opts.homeTab ?? "all";
  const bucket: CandidatesByType = {
    FOOD: [],
    CAFE: [],
    ACTIVITY: [],
    WALK: [],
    CULTURE: [],
  };

  const usable = places.filter((p) => {
    if (isExcludedFromCoursePool(p)) return false;
    const st = businessStateFromCard(p as any);
    return st !== "CLOSED";
  });

  for (const p of usable) {
    const t = mapPlaceToPlaceType(p);
    if (bucket[t].length < maxPer) bucket[t].push(p);
  }

  const rank = (arr: HomeCard[]) =>
    [...arr].sort(
      (a, b) =>
        qualityScoreFromCard(b as any) +
        tabCategoryBoost(b, homeTab) -
        (qualityScoreFromCard(a as any) + tabCategoryBoost(a, homeTab))
    );

  (Object.keys(bucket) as PlaceType[]).forEach((k) => {
    bucket[k] = rank(bucket[k]);
  });

  return bucket;
}

function poolsForStep(step: PlaceType, byType: CandidatesByType): PlaceType[] {
  return [step, ...fallbackOrderForStep(step).filter((x) => x !== step)];
}

function gatherCandidatesForStep(
  stepType: PlaceType,
  byType: CandidatesByType,
  usedIds: Set<string>
): HomeCard[] {
  const out: HomeCard[] = [];
  const seen = new Set<string>();
  for (const pt of poolsForStep(stepType, byType)) {
    for (const p of byType[pt] ?? []) {
      if (usedIds.has(p.id) || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
      if (out.length >= 36) return out;
    }
  }
  return out;
}

type BeamState = { cards: HomeCard[]; stepScoreSum: number };

function beamFillTemplate(
  template: PlaceType[],
  byType: CandidatesByType,
  obj: ScenarioObject,
  config: ScenarioConfig
): HomeCard[] | null {
  const nearOnly = obj.distanceTolerance === "near_only";
  const mealReq = obj.mealRequired === true;

  let beams: BeamState[] = [{ cards: [], stepScoreSum: 0 }];

  for (let si = 0; si < template.length; si++) {
    const stepType = template[si]!;
    const nextBeams: BeamState[] = [];
    for (const b of beams) {
      const usedIds = new Set(b.cards.map((c) => c.id));
      const brands = new Set<string>();
      for (const c of b.cards) {
        const bp = brandPrefix(c.name ?? "");
        if (bp) brands.add(bp);
      }
      const prev = b.cards.length ? b.cards[b.cards.length - 1]! : null;

      const rawPool = gatherCandidatesForStep(stepType, byType, usedIds);
      const ctxBase: Omit<StepScoreContext, "prev" | "stepIndex"> = {
        stepType,
        obj,
        config,
        nearOnly,
      };

      const scored = rawPool
        .map((card) => {
          if (
            (obj.scenario === "family_kids" || obj.scenario === "parent_child_outing") &&
            familyKidsBeamStepRejects(card, stepType, si, obj)
          ) {
            return null;
          }
          if (!servingOkForStep(card, stepType, obj, mealReq)) return null;
          const bp = brandPrefix(card.name ?? "");
          if (bp && brands.has(bp)) return null;
          if (b.cards.some((x) => mainCategory(x) === mainCategory(card))) return null;
          const ctx: StepScoreContext = { ...ctxBase, prev, stepIndex: si };
          const sc = computeStepScore(card, ctx);
          return { card, sc };
        })
        .filter((x): x is { card: HomeCard; sc: number } => x != null && x.sc > 8)
        .sort((a, b) => b.sc - a.sc)
        .slice(0, TOP_BRANCH);

      for (const { card, sc } of scored) {
        nextBeams.push({
          cards: [...b.cards, card],
          stepScoreSum: b.stepScoreSum + sc,
        });
      }
    }

    if (nextBeams.length === 0) return null;
    nextBeams.sort((a, b) => b.stepScoreSum - a.stepScoreSum);
    beams = nextBeams.slice(0, BEAM_WIDTH);
  }

  const best = beams[0];
  return best && best.cards.length === template.length ? best.cards : null;
}

function templateDefsFromScenarioConfig(scenario: ScenarioType, config: ScenarioConfig): CourseTemplateDefinition[] {
  const pref = config.preferredCourseTemplates ?? [];
  return pref.map((steps, i) => ({
    id: `cfg-${scenario}-${i}-${steps.join("-")}`,
    scenarios: [scenario],
    steps: [...steps],
    movementLevel: "medium",
    indoorPreference: "mixed",
    durationMinMinutes: Math.max(90, (config.defaultDurationHours ?? 2) * 45),
    durationMaxMinutes: (config.defaultDurationHours ?? 2) * 60 + 90,
    vibeTags: ["설정"],
  }));
}

function configWithDateStart(obj: ScenarioObject, config: ScenarioConfig): ScenarioConfig {
  if (obj.scenario !== "date") return config;
  const band = resolveDateTimeBand(obj);
  return { ...config, defaultStartTime: defaultStartTimeForDateBand(band) };
}

function mergeTemplateDefinitions(
  obj: ScenarioObject,
  config: ScenarioConfig,
  learningStore?: CourseLearningStore
): CourseTemplateDefinition[] {
  const ranked = rankTemplatesForScenario(obj, config, learningStore);
  const fromCfg = templateDefsFromScenarioConfig(obj.scenario, config);
  const sig = (d: CourseTemplateDefinition) => d.id;
  const seen = new Set<string>();
  const out: CourseTemplateDefinition[] = [];
  for (const d of [...ranked, ...fromCfg]) {
    const s = sig(d);
    if (seen.has(s)) continue;
    if (scoreTemplateSelection(d, obj, config) < -50) continue;
    seen.add(s);
    out.push(d);
  }
  return out.sort((a, b) => scoreTemplateSelection(b, obj, config) - scoreTemplateSelection(a, obj, config));
}

function jaccardTemplateSimilarity(a: PlaceType[], b: PlaceType[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  return inter / (sa.size + sb.size - inter + 0.001);
}

type ScoredPath = {
  def: CourseTemplateDefinition;
  cards: HomeCard[];
  finalScore: number;
  stepAvg: number;
  learned?: LearnedBoostParts;
};

function scorePath(
  def: CourseTemplateDefinition,
  cards: HomeCard[],
  obj: ScenarioObject,
  config: ScenarioConfig,
  learningStore: CourseLearningStore | undefined,
  recommendationPatternBoostMap: ReadonlyMap<string, number> | undefined
): ScoredPath | null {
  if (cards.length !== def.steps.length) return null;
  const nearOnly = obj.distanceTolerance === "near_only";
  let stepSum = 0;
  for (let i = 0; i < cards.length; i++) {
    const ctx: StepScoreContext = {
      prev: i ? cards[i - 1]! : null,
      stepType: def.steps[i]!,
      stepIndex: i,
      obj,
      config,
      nearOnly,
    };
    stepSum += computeStepScore(cards[i]!, ctx);
  }
  const stepAvg = stepSum / cards.length;
  let totalTravel = 0;
  for (let i = 0; i < cards.length - 1; i++) totalTravel += estimateTravelMinutes(cards[i]!, cards[i + 1]!);

  const tlConfig = configWithDateStart(obj, config);
  const { totalMinutes } = buildTimelineInner(cards, def.steps, tlConfig, def.id);
  const ctxK = contextFromScenarioObject(obj);
  const pKey = buildPatternKey({
    ...ctxK,
    templateId: def.id,
    stepPattern: stepPatternFromSteps(def.steps),
  });
  const recTable = getPatternBoostFromMap(pKey, recommendationPatternBoostMap);
  const learned = computeLearnedBoosts(learningStore, {
    obj,
    templateId: def.id,
    steps: def.steps,
    placeIds: cards.map((c) => c.id),
    totalTravelMin: totalTravel,
    def,
    cards,
    recommendationPatternTableBoost: recTable,
  });
  const courseScore = computeCourseScore(
    cards,
    def.steps,
    obj,
    config,
    totalMinutes,
    totalTravel,
    learned.total
  );
  const flowBias = scenarioCourseFlowBias(def.steps, obj.scenario);
  const finalScore = stepAvg * 0.42 + courseScore * 0.58 + flowBias * 0.12;
  return { def, cards, finalScore, stepAvg, learned };
}

function buildTimelineInner(
  stops: HomeCard[],
  template: PlaceType[],
  config: ScenarioConfig,
  seedKey: string
): { stops: CourseStop[]; totalMinutes: number } {
  const start = config.defaultStartTime ?? "11:00";
  const [sh, sm] = start.split(":").map((x) => parseInt(x, 10));
  let cursor = sh * 60 + (sm || 0);
  const out: CourseStop[] = [];

  for (let i = 0; i < stops.length; i++) {
    const p = stops[i]!;
    const ptype = template[i] ?? mapPlaceToPlaceType(p);
    const dwell = dwellMinutesForPlace(p, ptype, `${seedKey}-${i}`);
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    const startTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    let travelNext: number | undefined;
    if (i < stops.length - 1) {
      travelNext = estimateTravelMinutes(p, stops[i + 1]!);
    }
    const serving = inferServingTypeForPlace(p, ptype);
    out.push({
      placeId: p.id,
      placeName: p.name,
      placeType: ptype,
      categoryLabel: p.categoryLabel ?? p.category,
      dbCategory: p.category ?? null,
      servingType: serving,
      cardSnapshot: snapshotHomeCardForCourse(p),
      startTime,
      dwellMinutes: dwell,
      travelMinutesToNext: travelNext,
      businessState: businessStateFromCard(p as any),
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      mood: p.mood,
      tags: p.tags,
    });
    cursor += dwell + (travelNext ?? 0);
  }

  const totalMinutes = out.reduce((s, x) => s + x.dwellMinutes + (x.travelMinutesToNext ?? 0), 0);
  return { stops: out, totalMinutes };
}

function summaryFromStops(stops: CourseStop[]): string {
  const labels: Record<PlaceType, string> = {
    FOOD: "식사",
    CAFE: "카페",
    ACTIVITY: "액티비티",
    WALK: "산책",
    CULTURE: "문화",
  };
  return stops.map((s) => labels[s.placeType] ?? s.placeType).join(" → ");
}

function pickThreeDiverse(paths: ScoredPath[], obj: ScenarioObject): ScoredPath[] {
  const sorted = [...paths].sort((a, b) => b.finalScore - a.finalScore);

  if (obj.scenario === "date" && paths.length >= 1) {
    const out: ScoredPath[] = [];
    const usedIds = new Set<string>();
    for (const kind of ["activity", "mood", "light"] as const) {
      const hit = sorted.find((p) => inferDateCourseKind(p.def) === kind && !usedIds.has(p.def.id));
      if (hit) {
        out.push(hit);
        usedIds.add(hit.def.id);
      }
    }
    for (const p of sorted) {
      if (out.length >= 3) break;
      if (usedIds.has(p.def.id)) continue;
      const tooSimilar = out.some((o) => {
        if (p.cards[0]?.id === o.cards[0]?.id && p.def.steps.length === o.def.steps.length) {
          return jaccardTemplateSimilarity(p.def.steps, o.def.steps) > 0.85;
        }
        return jaccardTemplateSimilarity(p.def.steps, o.def.steps) > 0.92;
      });
      if (tooSimilar) continue;
      out.push(p);
      usedIds.add(p.def.id);
    }
    while (out.length < 3) {
      const next = sorted.find((p) => !usedIds.has(p.def.id));
      if (!next) break;
      out.push(next);
      usedIds.add(next.def.id);
    }
    return out.slice(0, 3);
  }

  const out: ScoredPath[] = [];
  const usedIds = new Set<string>();
  for (const level of ["low", "medium", "high"] as const) {
    const hit = sorted.find((p) => p.def.movementLevel === level && !usedIds.has(p.def.id));
    if (hit) {
      out.push(hit);
      usedIds.add(hit.def.id);
    }
  }
  for (const p of sorted) {
    if (out.length >= 3) break;
    if (usedIds.has(p.def.id)) continue;
    const tooSimilar = out.some((o) => {
      if (p.cards[0]?.id === o.cards[0]?.id && p.def.steps.length === o.def.steps.length) {
        return jaccardTemplateSimilarity(p.def.steps, o.def.steps) > 0.85;
      }
      return jaccardTemplateSimilarity(p.def.steps, o.def.steps) > 0.88;
    });
    if (tooSimilar) continue;
    out.push(p);
    usedIds.add(p.def.id);
  }
  if (out.length < 3) {
    for (const p of sorted) {
      if (out.length >= 3) break;
      if (usedIds.has(p.def.id)) continue;
      out.push(p);
      usedIds.add(p.def.id);
    }
  }
  return out.slice(0, 3);
}

/** @deprecated 호환용 — catalog 기반 `mergeTemplateDefinitions` 사용 권장 */
export function selectCourseTemplates(obj: ScenarioObject, config: ScenarioConfig): PlaceType[][] {
  return mergeTemplateDefinitions(obj, config, undefined).map((d) => d.steps);
}

export function buildTimeline(
  stops: HomeCard[],
  template: PlaceType[],
  config: ScenarioConfig
): { stops: CourseStop[]; totalMinutes: number } {
  return buildTimelineInner(stops, template, config, "legacy");
}

export function buildCourseCombination(
  template: PlaceType[],
  byType: CandidatesByType,
  usedBrands: Set<string>
): HomeCard[] {
  const config: ScenarioConfig = {
    label: "추천",
    primaryBadgeLabel: "추천",
    preferredPlaceTypes: ["FOOD", "CAFE", "ACTIVITY"],
    tagWeights: {},
  };
  const obj: ScenarioObject = {
    intentType: "scenario_recommendation",
    scenario: "generic",
    rawQuery: "",
    confidence: 0.5,
  };
  const nearOnly = false;
  const mealReq = false;
  const out: HomeCard[] = [];

  for (const step of template) {
    const prev = out.length ? out[out.length - 1]! : null;
    const usedIds = new Set(out.map((c) => c.id));
    const pool = gatherCandidatesForStep(step, byType, usedIds);
    const ctx: StepScoreContext = {
      prev,
      stepType: step,
      stepIndex: out.length,
      obj,
      config,
      nearOnly,
    };
    let chosen: HomeCard | undefined;
    for (const card of pool) {
      if (!servingOkForStep(card, step, obj, mealReq)) continue;
      const b = brandPrefix(card.name ?? "");
      if (b && usedBrands.has(b)) continue;
      if (out.some((x) => mainCategory(x) === mainCategory(card))) continue;
      if (computeStepScore(card, ctx) < 15) continue;
      chosen = card;
      break;
    }
    if (chosen) {
      const b = brandPrefix(chosen.name ?? "");
      if (b) usedBrands.add(b);
      out.push(chosen);
    }
  }
  return out;
}

function learningNarrativeSuffix(hint: LearnedBoostParts["narrativeHint"]): string | null {
  switch (hint) {
    case "popular_start":
      return "많은 사용자가 바로 출발한 코스예요";
    case "saved_often":
      return "저장이 많이 된 동선이에요";
    case "family_chosen":
      return "가족 외출로 선택이 많았던 코스예요";
    case "date_evening_popular":
      return "저녁 데이트로 반응이 좋았어요";
    default:
      return null;
  }
}

export function generateCourses(
  places: HomeCard[],
  obj: ScenarioObject,
  config: ScenarioConfig,
  maxCourses = 3,
  opts: {
    homeTab?: HomeTabKey;
    now?: Date;
    learningStore?: CourseLearningStore;
    /** `fetchRecommendationPatternBoostMap` 결과 — `recommendation_pattern_stats` */
    recommendationPatternBoostMap?: ReadonlyMap<string, number>;
  } = {}
): CoursePlan[] {
  const homeTab = opts.homeTab ?? "all";
  const courseObj: ScenarioObject =
    obj.scenario === "date" && opts.now != null
      ? { ...obj, dateTimeBand: resolveDateTimeBand(obj, opts.now) }
      : obj;

  let pool = places;
  if (
    obj.scenario === "family_kids" ||
    obj.scenario === "parent_child_outing" ||
    obj.scenario === "family"
  ) {
    pool = places.filter((p) => !isHardExcludedForKidsScenario(p, { rawQuery: obj.rawQuery ?? "" }));
  }
  const byType = collectCandidatesByType(pool, config, { homeTab });
  const defs = mergeTemplateDefinitions(courseObj, config, opts.learningStore).slice(0, MAX_TEMPLATES_TRY);

  const scoredPaths: ScoredPath[] = [];
  for (const def of defs) {
    const filled = beamFillTemplate(def.steps, byType, courseObj, config);
    if (!filled) continue;
    const sp = scorePath(
      def,
      filled,
      courseObj,
      config,
      opts.learningStore,
      opts.recommendationPatternBoostMap
    );
    if (sp) scoredPaths.push(sp);
  }

  const chosen = pickThreeDiverse(scoredPaths, courseObj).slice(0, maxCourses);
  const plans: CoursePlan[] = [];
  const timelineConfig = configWithDateStart(courseObj, config);

  for (let idx = 0; idx < chosen.length; idx++) {
    const { def, cards, learned } = chosen[idx]!;
    const { stops, totalMinutes } = buildTimelineInner(cards, def.steps, timelineConfig, def.id);
    const summaryLine = summaryFromStops(stops);
    const courseRank = idx;
    const id = `course-${def.id}-${courseRank}`;
    const travelMin = stops.reduce((s, x) => s + (x.travelMinutesToNext ?? 0), 0);
    const walkHeavy = def.steps.filter((x) => x === "WALK").length >= 1;
    let narrativeDescription = buildNarrativeDescription(def, totalMinutes, travelMin, walkHeavy, courseObj);
    const learnSuffix = learned?.narrativeHint ? learningNarrativeSuffix(learned.narrativeHint) : null;
    if (learnSuffix) narrativeDescription = `${narrativeDescription} · ${learnSuffix}`;

    plans.push({
      id,
      templateId: def.id,
      narrativeDescription,
      learningBoostTotal: learned?.total,
      learningNarrativeHint: learned?.narrativeHint,
      title: buildSituationCourseTitle(courseObj, config, id, def.steps, stops, courseRank),
      situationTitle: buildSituationCourseTitle(courseObj, config, id, def.steps, stops, courseRank),
      functionalTitle: buildFunctionalCourseTitle(courseObj, config, summaryLine),
      badges: buildCourseBadges(courseObj, def.steps, stops, courseRank),
      courseRank,
      scenario: obj.scenario,
      totalMinutes,
      template: def.steps,
      stops,
      summaryLine,
    });
  }

  if (plans.length === 0 && pool.length > 0) {
    const allowed = pool.filter((p) => !isExcludedFromCoursePool(p));
    if (allowed.length === 0) return plans;
    const p0 = allowed.find((p) => businessStateFromCard(p as any) !== "CLOSED") ?? allowed[0]!;
    const tpl: PlaceType[] = [mapPlaceToPlaceType(p0)];
    const { stops, totalMinutes } = buildTimelineInner([p0], tpl, config, "fallback");
    const summaryLine = summaryFromStops(stops);
    const courseRank = 0;
    const fid = "course-fallback-0";
    const sit = buildSituationCourseTitle(obj, config, fid, tpl, stops, courseRank);
    plans.push({
      id: fid,
      title: sit,
      situationTitle: sit,
      functionalTitle: buildFunctionalCourseTitle(obj, config, summaryLine),
      badges: buildCourseBadges(obj, tpl, stops, courseRank),
      courseRank,
      scenario: obj.scenario,
      totalMinutes,
      template: tpl,
      stops,
      summaryLine,
      narrativeDescription: "주변에서 이어가기 좋은 한 곳부터 시작해 볼 수 있어",
    });
  }

  return plans;
}
