import type { DateTimeBand, ScenarioObject } from "./types";
import { defaultStartTimeForDateBand, inferDateTimeBandFromQuery } from "./dateCourseContext";
import { normIntentQuery } from "./intentQueryNormalize";

const BUFFER_MINUTES = 10;
const COARSE_BAND_RE = /오전|아침|점심|브런치|오후|저녁|디너|밤/;
const FUTURE_DAY_RE = /내일|모레/;

export function hmToMinutes(hm: string): number {
  const [hRaw, mRaw] = String(hm ?? "").split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, h) * 60 + Math.max(0, Math.min(59, m));
}

export function minutesToHm(total: number): string {
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function ceilToFiveMinutes(total: number): number {
  return Math.ceil(total / 5) * 5;
}

export function earliestFeasibleHm(now: Date): string {
  const raw = now.getHours() * 60 + now.getMinutes() + BUFFER_MINUTES;
  return minutesToHm(ceilToFiveMinutes(raw));
}

export function isFutureDayQuery(rawQuery: string): boolean {
  return FUTURE_DAY_RE.test(normIntentQuery(rawQuery));
}

export function hasCoarseTimeBandCue(rawQuery: string, obj?: Pick<ScenarioObject, "timeOfDay">): boolean {
  const q = normIntentQuery(rawQuery);
  if (COARSE_BAND_RE.test(q)) return true;
  return Boolean(obj?.timeOfDay);
}

function applyPeriod(hour: number, minute: number, period: string | undefined): string | null {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  let h = hour;
  const p = period ?? "";
  if (p === "오전" || p === "아침") {
    if (h === 12) h = 0;
    else if (h > 12) return null;
  } else if (p === "오후" || p === "점심" || p === "저녁" || p === "밤") {
    if (h < 12) h += 12;
  } else if (h <= 7) {
    h += 12;
  }
  if (h > 23) return null;
  return minutesToHm(h * 60 + minute);
}

/** Narrow Korean / numeric start-time parse. Returns HH:MM or null. */
export function parseExplicitStartTime(rawQuery: string): string | null {
  const q = normIntentQuery(rawQuery);
  if (!q) return null;

  const colon = q.match(/(?:^|[^\d])(\d{1,2}):(\d{2})/);
  if (colon) {
    const h = Number(colon[1]);
    const m = Number(colon[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return minutesToHm(h * 60 + m);
  }

  const withMin = q.match(/(오전|아침|오후|점심|저녁|밤)?\s*(\d{1,2})\s*시\s*(\d{1,2})\s*분/);
  if (withMin) {
    return applyPeriod(Number(withMin[2]), Number(withMin[3]), withMin[1]);
  }

  const withSi = q.match(/(오전|아침|오후|점심|저녁|밤)?\s*(\d{1,2})\s*시/);
  if (withSi) {
    return applyPeriod(Number(withSi[2]), 0, withSi[1]);
  }

  return null;
}

function bandFromTimeOfDay(t: ScenarioObject["timeOfDay"] | undefined): DateTimeBand | undefined {
  if (t === "morning" || t === "lunch" || t === "afternoon" || t === "brunch") return "daytime";
  if (t === "dinner") return "evening";
  if (t === "night") return "night";
  return undefined;
}

function bandFromCoarseQuery(q: string): DateTimeBand | undefined {
  if (/(밤|심야)/.test(q)) return "night";
  if (/(저녁|디너)/.test(q)) return "evening";
  if (/(오전|아침|점심|브런치|오후)/.test(q)) return "daytime";
  return undefined;
}

/**
 * Existing preferred band/scenario default, or null when the query has no coarse band
 * (clock-derived dateTimeBand must not count as a user band).
 */
export function preferredBandDefaultHm(
  rawQuery: string,
  obj: Pick<ScenarioObject, "scenario" | "timeOfDay">,
  scenarioDefault?: string | null
): string | null {
  const q = normIntentQuery(rawQuery);
  if (!hasCoarseTimeBandCue(q, obj)) return null;

  if (obj.scenario === "date") {
    const band =
      inferDateTimeBandFromQuery(q) ?? bandFromTimeOfDay(obj.timeOfDay) ?? bandFromCoarseQuery(q);
    if (band) return defaultStartTimeForDateBand(band);
  }

  return scenarioDefault ?? null;
}

function maxHm(a: string, b: string): string {
  return hmToMinutes(a) >= hmToMinutes(b) ? a : b;
}

export type ResolveCourseStartTimeInput = {
  rawQuery: string;
  obj: Pick<ScenarioObject, "scenario" | "timeOfDay">;
  now?: Date | null;
  /** Existing scenario/band default (e.g. 12:00 family, 18:30 date evening). */
  scenarioDefault?: string | null;
};

/**
 * Course Time V1: explicit time > today clamp to now+10 (5-min ceil) > band default.
 * Future-day requests are never clamped to today's clock.
 * When `now` is omitted, legacy scenario/band defaults are preserved.
 */
export function resolveCourseStartTime(input: ResolveCourseStartTimeInput): string {
  const raw = String(input.rawQuery ?? "");
  const explicit = parseExplicitStartTime(raw);
  const future = isFutureDayQuery(raw);
  const bandPref = preferredBandDefaultHm(raw, input.obj, input.scenarioDefault);
  const legacy = bandPref ?? input.scenarioDefault ?? "11:00";

  if (future) {
    return explicit ?? legacy;
  }

  if (!input.now) {
    return explicit ?? legacy;
  }

  const earliest = earliestFeasibleHm(input.now);
  if (explicit) return maxHm(explicit, earliest);
  if (bandPref) return maxHm(bandPref, earliest);
  return earliest;
}
