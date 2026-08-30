import { parseScenarioIntent } from "@/lib/scenarioEngine/intentClassification";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";

function hasDatePhrase(raw: string): boolean {
  return /데이트|연인|커플/.test(raw);
}

function hasKidsOutingShape(raw: string): boolean {
  return /갈\s*곳|어디\s*가|놀러|나들이|추천/.test(raw);
}

/**
 * Current utterance already carries a full intent that should replace
 * leftover conversation scenario — not a fragment follow-up.
 *
 * Fragments such as 실내로 / 조용한 곳으로 / 가까운 데 stay false.
 */
export function isSelfContainedCurrentTurn(
  text: string,
  previous: ScenarioObject | null | undefined
): boolean {
  const raw = String(text ?? "").trim();
  if (!raw) return false;

  const parsed = parseScenarioIntent(raw);
  const purposes = parsed.queryUnderstanding?.purposeIntents ?? [];
  const companions = parsed.queryUnderstanding?.companionIntents ?? [];
  const strongVertical = Boolean(
    parsed.queryUnderstanding?.strongVertical ||
      (parsed.intentType === "search_strict" && parsed.intentCategory)
  );

  const kidsIndoorPlay =
    parsed.withKids === true &&
    (purposes.includes("indoor_play") ||
      (parsed.indoorPreferred === true && (/놀\s*|체험/.test(raw) || purposes.includes("play"))));

  const explicitDate = parsed.scenario === "date" && hasDatePhrase(raw);
  const explicitFood = parsed.intentCategory === "FOOD" && strongVertical;
  const explicitCafe = parsed.intentCategory === "CAFE" && strongVertical;
  const explicitOtherVertical =
    strongVertical &&
    (parsed.intentCategory === "BEAUTY" ||
      parsed.intentCategory === "ACTIVITY" ||
      parsed.intentCategory === "FITNESS" ||
      parsed.intentCategory === "LIFE");

  const kidsOuting =
    parsed.withKids === true && hasKidsOutingShape(raw) && raw.replace(/\s+/g, "").length >= 8;

  if (kidsIndoorPlay || explicitDate || explicitFood || explicitCafe || explicitOtherVertical) {
    return true;
  }

  if (!previous) return false;

  if (kidsOuting && (previous.scenario === "date" || previous.scenario === "solo" || previous.intentCategory === "CAFE")) {
    return true;
  }
  if (explicitDate && previous.withKids === true) return true;
  if (kidsOuting && previous.withKids !== true) return true;

  if (companions.includes("couple") && hasDatePhrase(raw)) return true;

  return false;
}
