import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import type { MergeIntentOptions, RefinementType } from "./types";

const ARRAY_KEYS = new Set<string>([
  "foodPreference",
  "vibePreference",
  "hardConstraints",
  "softConstraints",
  "menuIntent",
  "mood",
  "includes",
  "excludes",
]);

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr.filter((x) => x != null && x !== ""))] as T[];
}

function mergeArrays(prev: unknown, next: unknown): unknown {
  const a = Array.isArray(prev) ? prev : [];
  const b = Array.isArray(next) ? next : [];
  return uniq([...a, ...b]);
}

/**
 * 이전 의도와 이번 partial 을 refinement 규칙에 맞게 병합.
 */
export function mergeIntent(
  previous: ScenarioObject,
  partial: Partial<ScenarioObject>,
  refinement: RefinementType,
  options?: MergeIntentOptions
): ScenarioObject {
  const locks = options?.lockedFields ?? new Set<string>();

  if (refinement === "new_request") {
    const base = { ...partial } as ScenarioObject;
    const preserve = options?.preserveOnReset ?? ["timeOfDay", "distanceTolerance", "region"];
    const out = { ...base };
    for (const key of preserve) {
      const k = key as keyof ScenarioObject;
      if ((out as any)[k] == null && previous[k] != null) {
        (out as any)[k] = previous[k];
      }
    }
    return out;
  }

  if (refinement === "broaden") {
    const merged: ScenarioObject = {
      ...previous,
      rawQuery: partial.rawQuery ?? previous.rawQuery,
    };
    if (partial.foodSubCategory === undefined) delete (merged as any).foodSubCategory;
    if (partial.intentStrict === false) merged.intentStrict = false;
    return merged;
  }

  if (refinement === "reject" || refinement === "clarify") {
    return {
      ...previous,
      rawQuery: partial.rawQuery ?? previous.rawQuery,
    };
  }

  const merged: ScenarioObject = { ...previous };

  for (const key of Object.keys(partial) as (keyof ScenarioObject)[]) {
    if (key === "rawQuery") continue;
    const val = partial[key];
    if (val === undefined) continue;
    if (locks.has(String(key))) continue;

    if (ARRAY_KEYS.has(String(key))) {
      const prevArr = (previous as any)[key] as unknown[] | undefined;
      const nextArr = val as unknown[];
      (merged as any)[key] = mergeArrays(prevArr, nextArr);
    } else {
      (merged as any)[key] = val;
    }
  }

  merged.rawQuery = partial.rawQuery ?? previous.rawQuery;

  if (refinement === "narrow" && partial.distanceTolerance === "near_only") {
    merged.distanceTolerance = "near_only";
  }

  return merged;
}
