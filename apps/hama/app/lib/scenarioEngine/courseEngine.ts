import type { HomeCard } from "@/lib/storeTypes";
import { businessStateFromCard, qualityScoreFromCard } from "@/lib/recommend/scoreParts";
import { DEFAULT_DWELL_MINUTES, estimateTravelMinutes } from "./courseConstants";
import { mapPlaceToPlaceType } from "./placeTypeMap";
import type { ScenarioConfig, ScenarioObject, PlaceType, CoursePlan, CourseStop } from "./types";

const DEFAULT_TEMPLATES: PlaceType[][] = [["FOOD", "CAFE"]];

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
  opts: { maxPerType?: number } = {}
): CandidatesByType {
  const maxPer = opts.maxPerType ?? 24;
  const bucket: CandidatesByType = {
    FOOD: [],
    CAFE: [],
    ACTIVITY: [],
    WALK: [],
    CULTURE: [],
  };

  const usable = places.filter((p) => {
    const st = businessStateFromCard(p as any);
    return st !== "CLOSED";
  });

  for (const p of usable) {
    const t = mapPlaceToPlaceType(p);
    if (bucket[t].length < maxPer) bucket[t].push(p);
  }

  const rank = (arr: HomeCard[]) =>
    [...arr].sort((a, b) => qualityScoreFromCard(b as any) - qualityScoreFromCard(a as any));

  (Object.keys(bucket) as PlaceType[]).forEach((k) => {
    bucket[k] = rank(bucket[k]);
  });

  return bucket;
}

function brandPrefix(name: string): string | null {
  const first = String(name).trim().split(/[\s|,.]+/)[0] ?? "";
  return first.length >= 2 ? first.toLowerCase() : null;
}

export function buildCourseCombination(
  template: PlaceType[],
  byType: CandidatesByType,
  usedBrands: Set<string>
): HomeCard[] {
  const out: HomeCard[] = [];
  for (const step of template) {
    let pool = byType[step] ?? [];
    if (pool.length === 0) {
      const fallbacks: PlaceType[] = ["FOOD", "CAFE", "ACTIVITY", "CULTURE", "WALK"];
      for (const f of fallbacks) {
        if (f === step) continue;
        if ((byType[f] ?? []).length > 0) {
          pool = byType[f];
          break;
        }
      }
    }
    const chosen = pool.find((p) => {
      const b = brandPrefix(p.name ?? "");
      if (b && usedBrands.has(b)) return false;
      return !out.some((o) => o.id === p.id);
    });
    if (chosen) {
      const b = brandPrefix(chosen.name ?? "");
      if (b) usedBrands.add(b);
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
    });
    cursor += dwell + (travelNext ?? 0);
  }

  const totalMinutes = out.reduce((s, x) => s + x.dwellMinutes + (x.travelMinutesToNext ?? 0), 0);
  return { stops: out, totalMinutes };
}

export function generateCourseTitle(obj: ScenarioObject, config: ScenarioConfig, summaryLine: string): string {
  const head = obj.intentType === "course_generation" ? `${config.label} 코스` : config.label;
  return `${head} · ${summaryLine}`;
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
  maxCourses = 2
): CoursePlan[] {
  const templates = selectCourseTemplates(obj, config);
  const byType = collectCandidatesByType(places, config);
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
    plans.push({
      id: `course-${plans.length}-${tpl.join("-")}`,
      title: generateCourseTitle(obj, config, summaryLine),
      scenario: obj.scenario,
      totalMinutes,
      template: tpl,
      stops,
      summaryLine,
    });
  }

  if (plans.length === 0 && places.length > 0) {
    const p0 = places.find((p) => businessStateFromCard(p as any) !== "CLOSED") ?? places[0]!;
    const tpl: PlaceType[] = [mapPlaceToPlaceType(p0)];
    const { stops, totalMinutes } = buildTimeline([p0], tpl, config);
    plans.push({
      id: "course-fallback-0",
      title: generateCourseTitle(obj, config, summaryFromStops(stops)),
      scenario: obj.scenario,
      totalMinutes,
      template: tpl,
      stops,
      summaryLine: summaryFromStops(stops),
    });
  }

  return plans;
}
