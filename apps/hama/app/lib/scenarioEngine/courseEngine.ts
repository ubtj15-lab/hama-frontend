import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { businessStateFromCard, qualityScoreFromCard } from "@/lib/recommend/scoreParts";
import { DEFAULT_DWELL_MINUTES, estimateTravelMinutes } from "./courseConstants";
import { mapPlaceToPlaceType } from "./placeTypeMap";
import type { ScenarioConfig, ScenarioObject, PlaceType, CoursePlan, CourseStop } from "./types";
import { buildCourseBadges, buildFunctionalCourseTitle, buildSituationCourseTitle } from "./coursePresentation";

const DEFAULT_TEMPLATES: PlaceType[][] = [["FOOD", "CAFE"]];

const TAB_CATEGORY_BOOST = 25;

/** 기본 데이트 코스에서 제외(미용실 전용 플로우). */
function isExcludedFromDefaultCourse(p: HomeCard): boolean {
  return String(p.category ?? "").toLowerCase() === "salon";
}

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

export function selectCourseTemplates(obj: ScenarioObject, config: ScenarioConfig): PlaceType[][] {
  const base = (config.preferredCourseTemplates ?? DEFAULT_TEMPLATES) as PlaceType[][];
  const templates = base.map((t) => [...t]);
  const rain = obj.weatherHint === "rain" || obj.weatherHint === "snow";
  const indoor = obj.indoorPreferred === true;
  const night = obj.timeOfDay === "night";

  const scoreTpl = (t: PlaceType[]): number => {
    let s = 10;
    if (rain || indoor) s -= t.filter((x) => x === "WALK").length * 8;
    if (night && obj.withKids) s -= t.filter((x) => x === "WALK").length * 4;
    if ((config.indoorBias ?? 0) > 0.3 && t.includes("ACTIVITY")) s += 2;
    return s;
  };

  return [...templates].sort((a, b) => scoreTpl(b) - scoreTpl(a));
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
    if (isExcludedFromDefaultCourse(p)) return false;
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

function brandPrefix(name: string): string | null {
  const first = String(name).trim().split(/[\s|,.]+/)[0] ?? "";
  return first.length >= 2 ? first.toLowerCase() : null;
}

function pickCardForStep(
  pool: HomeCard[],
  out: HomeCard[],
  usedBrands: Set<string>,
  usedCategories: Set<string>
): HomeCard | undefined {
  const baseOk = (p: HomeCard) => {
    if (out.some((o) => o.id === p.id)) return false;
    const b = brandPrefix(p.name ?? "");
    if (b && usedBrands.has(b)) return false;
    return true;
  };
  return (
    pool.find((p) => baseOk(p) && !usedCategories.has(mainCategory(p))) ?? pool.find((p) => baseOk(p))
  );
}

export function buildCourseCombination(
  template: PlaceType[],
  byType: CandidatesByType,
  usedBrands: Set<string>
): HomeCard[] {
  const out: HomeCard[] = [];
  const usedCategories = new Set<string>();
  for (const step of template) {
    const pools: HomeCard[][] = [];
    const primary = byType[step] ?? [];
    if (primary.length) pools.push(primary);
    for (const f of fallbackOrderForStep(step)) {
      if (f === step) continue;
      const pl = byType[f] ?? [];
      if (pl.length) pools.push(pl);
    }
    let chosen: HomeCard | undefined;
    for (const pool of pools) {
      chosen = pickCardForStep(pool, out, usedBrands, usedCategories);
      if (chosen) break;
    }
    if (chosen) {
      const b = brandPrefix(chosen.name ?? "");
      if (b) usedBrands.add(b);
      usedCategories.add(mainCategory(chosen));
      out.push(chosen);
    }
  }
  return out;
}

export function buildTimeline(
  stops: HomeCard[],
  template: PlaceType[],
  config: ScenarioConfig
): { stops: CourseStop[]; totalMinutes: number } {
  const start = config.defaultStartTime ?? "11:00";
  const [sh, sm] = start.split(":").map((x) => parseInt(x, 10));
  let cursor = sh * 60 + (sm || 0);
  const out: CourseStop[] = [];
  let totalTravel = 0;

  for (let i = 0; i < stops.length; i++) {
    const p = stops[i]!;
    const ptype = template[i] ?? mapPlaceToPlaceType(p);
    const dwell = DEFAULT_DWELL_MINUTES[ptype] ?? 70;
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    const startTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    let travelNext: number | undefined;
    if (i < stops.length - 1) {
      travelNext = estimateTravelMinutes(p, stops[i + 1]!);
      totalTravel += travelNext;
    }
    out.push({
      placeId: p.id,
      placeName: p.name,
      placeType: ptype,
      categoryLabel: p.categoryLabel ?? p.category,
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

export function generateCourses(
  places: HomeCard[],
  obj: ScenarioObject,
  config: ScenarioConfig,
  maxCourses = 2,
  opts: { homeTab?: HomeTabKey } = {}
): CoursePlan[] {
  const homeTab = opts.homeTab ?? "all";
  const templates = selectCourseTemplates(obj, config);
  const byType = collectCandidatesByType(places, config, { homeTab });
  const usedGlobally = new Set<string>();
  const plans: CoursePlan[] = [];

  for (const tpl of templates) {
    if (plans.length >= maxCourses) break;
    const brands = new Set(usedGlobally);
    const combo = buildCourseCombination(tpl, byType, brands);
    if (combo.length === 0) continue;
    combo.forEach((p) => {
      const b = brandPrefix(p.name ?? "");
      if (b) usedGlobally.add(b);
    });
    const { stops, totalMinutes } = buildTimeline(combo, tpl, config);
    const summaryLine = summaryFromStops(stops);
    const courseRank = plans.length;
    const id = `course-${courseRank}-${tpl.join("-")}`;
    const situationTitle = buildSituationCourseTitle(obj, config, id, tpl, stops, courseRank);
    const functionalTitle = buildFunctionalCourseTitle(obj, config, summaryLine);
    const badges = buildCourseBadges(obj, tpl, stops, courseRank);
    plans.push({
      id,
      title: situationTitle,
      situationTitle,
      functionalTitle,
      badges,
      courseRank,
      scenario: obj.scenario,
      totalMinutes,
      template: tpl,
      stops,
      summaryLine,
    });
  }

  if (plans.length === 0 && places.length > 0) {
    const allowed = places.filter((p) => !isExcludedFromDefaultCourse(p));
    if (allowed.length === 0) return plans;
    const p0 = allowed.find((p) => businessStateFromCard(p as any) !== "CLOSED") ?? allowed[0]!;
    const tpl: PlaceType[] = [mapPlaceToPlaceType(p0)];
    const { stops, totalMinutes } = buildTimeline([p0], tpl, config);
    const summaryLine = summaryFromStops(stops);
    const courseRank = plans.length;
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
    });
  }

  return plans;
}
