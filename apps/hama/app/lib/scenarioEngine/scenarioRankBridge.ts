import type { IntentionType } from "@/lib/intention";
import type { RecommendScenarioKey } from "../recommend/scenarioWeights";
import type { ScenarioObject, ScenarioType } from "./types";

/** 랭킹·태그 규칙용 — 확장 시나리오 → 기존 4키 축약 */
export function scenarioTypeToRankKey(t: ScenarioType): RecommendScenarioKey {
  switch (t) {
    case "date":
      return "date";
    case "solo":
      return "solo";
    case "group":
    case "friends":
      return "group";
    case "family":
    case "family_kids":
    case "parent_child_outing":
      return "family";
    case "parents":
      return "date";
    default:
      return "solo";
  }
}

/** 레거시 intent 훅·로그용 */
export function scenarioObjectToIntention(obj: ScenarioObject | null | undefined): IntentionType {
  if (!obj) return "none";
  switch (obj.scenario) {
    case "date":
    case "parents":
      return "date";
    case "solo":
      return "solo";
    case "family":
    case "family_kids":
    case "parent_child_outing":
      return "family";
    case "group":
    case "friends":
      return "meeting";
    default:
      return "none";
  }
}
