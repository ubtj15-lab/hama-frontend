import { describe, expect, it } from "vitest";
import { generateCourses } from "../courseEngine";
import { parseScenarioIntent } from "../parseScenarioIntent";
import { resolveScenarioConfig } from "../resolveScenarioConfig";
import {
  earliestFeasibleHm,
  parseExplicitStartTime,
  resolveCourseStartTime,
} from "../courseStartTime";
import type { HomeCard } from "@/lib/storeTypes";

function at(h: number, m: number): Date {
  return new Date(2026, 8, 5, h, m, 0, 0);
}

function startOf(q: string, now: Date): string {
  const parsed = parseScenarioIntent(q);
  const cfg = resolveScenarioConfig(parsed);
  return resolveCourseStartTime({
    rawQuery: q,
    obj: parsed,
    now,
    scenarioDefault: cfg.defaultStartTime,
  });
}

function card(
  id: string,
  category: string,
  lat: number,
  lng: number
): HomeCard {
  return { id, name: id, category, lat, lng };
}

describe("Course Time V1 helper", () => {
  it("TODAY no-time: now + 10 then ceil to 5 minutes", () => {
    const cases: Array<[number, number, string]> = [
      [9, 10, "09:20"],
      [11, 45, "11:55"],
      [14, 20, "14:30"],
      [16, 30, "16:40"],
      [19, 10, "19:20"],
      [21, 30, "21:40"],
    ];
    for (const [h, m, expected] of cases) {
      const now = at(h, m);
      expect(earliestFeasibleHm(now), `${h}:${m}`).toBe(expected);
      expect(startOf("데이트 코스", now), `데이트 코스 @${h}:${m}`).toBe(expected);
      expect(hmToMin(startOf("오늘 데이트 코스", now)) >= hmToMin(expected)).toBe(true);
    }
  });

  it("TODAY band: max(band default, earliest feasible)", () => {
    expect(startOf("오늘 오후 데이트 코스", at(14, 20))).not.toBe("11:00");
    expect(hmToMin(startOf("오늘 오후 데이트 코스", at(14, 20)))).toBeGreaterThanOrEqual(hmToMin("14:30"));

    expect(startOf("오늘 저녁 데이트 코스", at(16, 30))).toBe("18:30");

    expect(startOf("오늘 저녁 데이트 코스", at(19, 10))).not.toBe("18:30");
    expect(hmToMin(startOf("오늘 저녁 데이트 코스", at(19, 10)))).toBeGreaterThanOrEqual(hmToMin("19:20"));
  });

  it("parses explicit Korean / numeric start times", () => {
    expect(parseExplicitStartTime("오늘 오후 3시부터 데이트 코스")).toBe("15:00");
    expect(parseExplicitStartTime("오늘 15:30부터 코스")).toBe("15:30");
    expect(parseExplicitStartTime("오늘 저녁 7시부터 코스")).toBe("19:00");
    expect(parseExplicitStartTime("오전 11시")).toBe("11:00");
    expect(parseExplicitStartTime("3시 30분")).toBe("15:30");
    expect(parseExplicitStartTime("15시")).toBe("15:00");
    expect(parseExplicitStartTime("15시 30분")).toBe("15:30");
  });

  it("EXPLICIT future-today wins exactly; past-today clamps", () => {
    expect(startOf("오늘 오후 3시부터 데이트 코스", at(11, 0))).toBe("15:00");
    expect(startOf("오늘 15:30부터 코스", at(11, 0))).toBe("15:30");
    expect(startOf("오늘 저녁 7시부터 코스", at(11, 0))).toBe("19:00");
    expect(hmToMin(startOf("오늘 오후 3시부터 코스", at(17, 0)))).toBeGreaterThanOrEqual(hmToMin("17:10"));
  });

  it("FUTURE day is not clamped to today clock", () => {
    expect(startOf("내일 오후 3시부터 코스", at(19, 10))).toBe("15:00");
    expect(startOf("내일 저녁 데이트", at(19, 10))).toBe("18:30");
  });
});

describe("Course Time V1 live-style timeline", () => {
  it("16:20 today/no-time first stop >= 16:30 and later stops move forward", () => {
    const q = "데이트 코스";
    const parsed = parseScenarioIntent(q);
    const cfg = resolveScenarioConfig(parsed);
    const pool = [
      card("r1", "restaurant", 37.1498, 127.0772),
      card("c1", "cafe", 37.151, 127.079),
      card("a1", "activity", 37.153, 127.081),
      card("r2", "restaurant", 37.148, 127.075),
      card("c2", "cafe", 37.152, 127.08),
      card("a2", "activity", 37.154, 127.082),
    ];
    const plans = generateCourses(pool, parsed, cfg, 3, { now: at(16, 20) });
    expect(plans.length).toBeGreaterThan(0);
    const stops = plans[0]!.stops;
    expect(hmToMin(stops[0]!.startTime)).toBeGreaterThanOrEqual(hmToMin("16:30"));
    for (let i = 1; i < stops.length; i++) {
      const prev = stops[i - 1]!;
      const cur = stops[i]!;
      const expected = hmToMin(prev.startTime) + prev.dwellMinutes + (prev.travelMinutesToNext ?? 0);
      expect(hmToMin(cur.startTime)).toBe(expected);
      expect(hmToMin(cur.startTime)).toBeGreaterThan(hmToMin(prev.startTime));
    }
  });
});

function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
