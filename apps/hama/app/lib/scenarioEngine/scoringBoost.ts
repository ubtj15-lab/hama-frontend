import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioConfig } from "./types";
import { mapPlaceToPlaceType } from "./placeTypeMap";

/** config.tagWeights: 키워드가 blob(공백 제거)에 포함되면 가산 — 시나리오 특화 보조 점수 */
export function configTagBoostRaw(blob: string, config: ScenarioConfig | null): number {
  if (!config?.tagWeights) return 0;
  const b = blob.replace(/\s/g, "").toLowerCase();
  let s = 0;
  for (const [k, w] of Object.entries(config.tagWeights)) {
    const c = k.replace(/\s/g, "").toLowerCase();
    if (c.length >= 1 && b.includes(c)) s += w;
  }
  return Math.min(50, s);
}

/** 선호 PlaceType 순서에 맞는지 0~14 */
export function placeTypePreferenceRaw(place: HomeCard, config: ScenarioConfig | null): number {
  if (!config?.preferredPlaceTypes?.length) return 7;
  const t = mapPlaceToPlaceType(place);
  const i = config.preferredPlaceTypes.indexOf(t);
  if (i === 0) return 14;
  if (i === 1) return 11;
  if (i === 2) return 8;
  if (i >= 0) return 5;
  return 0;
}
