import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { generateCourses } from "./courseEngine";
import { resolveScenarioConfig } from "./resolveScenarioConfig";
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
