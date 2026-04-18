import type { HomeCard } from "../storeTypes";
import type { ChildAgeGroup, FamilyActivityType, ScenarioObject, WeatherCondition } from "./types";

function norm(q: string): string {
  return String(q ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 쿼리에서 아이 연령대 추론 (family 시나리오용).
 */
export function inferChildAgeGroupFromQuery(rawQuery: string): ChildAgeGroup {
  const q = norm(rawQuery);

  const toddlerSignals =
    /(아기|유아|미취학|어린\s*아이|유모차|영유아|돌잔치|보육|놀이방|기저귀)/.test(q);
  const childSignals =
    /(초등|초등생|학교\s*끝|방학|7\s*살|8\s*살|9\s*살|10\s*살|11\s*살|12\s*살|아이들|형제)/.test(q);

  if (toddlerSignals && childSignals) return "mixed";
  if (toddlerSignals) return "toddler";
  if (childSignals) return "child";
  if (/(아이|키즈|가족)/.test(q)) return "unknown";
  return "unknown";
}

/**
 * `weatherCondition` 수동값 우선, 없으면 weatherHint·쿼리 키워드로 합성.
 */
export function resolveWeatherCondition(obj: ScenarioObject): WeatherCondition {
  if (obj.weatherCondition && obj.weatherCondition !== "unknown") {
    return obj.weatherCondition;
  }

  const q = norm(obj.rawQuery ?? "");

  if (/(미세먼지|초미세|대기\s*질|공기\s*안\s*좋)/.test(q)) return "bad_air";
  if (/(폭염|무더위|더운\s*날|너무\s*더|한여름\s*한낮)/.test(q)) return "hot";
  if (/(한파|추운\s*날|너무\s*추|영하)/.test(q)) return "cold";
  if (/(비\s*오는|장마|우산|소나기)/.test(q)) return "rainy";

  const h = obj.weatherHint;
  if (h === "rain") return "rainy";
  if (h === "snow") return "cold";
  if (h === "clear") return "clear";

  if (obj.weatherCondition === "unknown") return "unknown";
  return "unknown";
}

/**
 * 장소 카드 → family activity 유형 (점수 보정용).
 */
export function inferFamilyActivityType(card: HomeCard): FamilyActivityType {
  const name = norm(card.name ?? "");
  const tags = (card.tags ?? []).map((t) => norm(String(t)));
  const blob = [name, ...tags].join(" ");

  if (/(키즈\s*카페|키즈카페|실내\s*놀이|유아\s*체험|놀이방|키즈존)/.test(blob)) {
    return "kids_indoor";
  }
  if (/(레이저|볼링|트램폴린|클라이밍|스포츠|액티비티|vr|방탈출)/.test(blob)) {
    return "active_play";
  }
  if (/(박물관|과학관|전시|체험관|교육|학습)/.test(blob)) {
    return "learning";
  }
  if (/(공원|산책|야외|놀이터|숲|강변)/.test(blob)) {
    return "kids_outdoor";
  }
  if (/(카페|브런치|디저트|베이커리)/.test(blob)) {
    return "quiet_rest";
  }
  if (/(가족|키즈|유아|아이|패밀리)/.test(blob)) {
    return "mixed_family";
  }
  return "unknown";
}

export function isFamilyLikeScenario(scenario: string): boolean {
  return scenario === "family" || scenario === "family_kids" || scenario === "parent_child_outing";
}
