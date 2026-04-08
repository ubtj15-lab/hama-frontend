import type { HomeCard } from "@/lib/storeTypes";
import type { FoodSubCategory, ScenarioObject } from "@/lib/scenarioEngine/types";
import {
  foodMenuMatchNormalized,
  foodMenuMatchRaw,
  placeTextBlob,
} from "./foodIntentRanking";
import { SCENARIO_TAG_RULES, SCENARIO_RAW_CAP, type RecommendScenarioKey } from "./scenarioWeights";
import { scenarioTypeToRankKey } from "@/lib/scenarioEngine/scenarioRankBridge";
import { distanceScoreFromKm, qualityScoreFromCard } from "./scoreParts";

const PREF_HINTS: Record<string, string[]> = {
  not_spicy: ["순한", "안맵", "담백", "맵지", "안 매운"],
  spicy_brothy: ["얼큰", "칼칼", "매콤", "맵은", "맵게"],
  light_clean: ["담백", "깔끔", "심플"],
  light: ["가벼운", "부담", "다이어트", "담백"],
  hearty: ["든든", "푸짐", "보양"],
  brothy: ["국물", "탕", "국수", "면", "짬뽕", "라면"],
  hangover: ["해장", "뼈해장"],
  kid_friendly_menu: ["키즈", "유아", "아이", "어린이", "토이"],
  parent_friendly_menu: ["한정식", "상견례", "가족", "개별실", "룸"],
};

const VIBE_HINTS: Record<string, string[]> = {
  atmospheric: ["분위기", "감성", "데이트", "인생", "로맨틱"],
  calm: ["조용", "한적", "잔잔", "프라이빗"],
  conversation_friendly: ["대화", "소규모"],
  emotional: ["감성", "감미"],
};

const SOFT_HINTS: Record<string, string[]> = {
  light: ["가벼운", "부담", "간단"],
  rainy_day_food: ["전", "부침", "국물", "따끈", "뜨끈"],
  calm_env: ["조용", "한적"],
  parking_friendly: ["주차", "발렛", "주차장"],
};

const SUB_HARD: Record<string, FoodSubCategory> = {
  sub_chinese: "CHINESE",
  sub_japanese: "JAPANESE",
  sub_korean: "KOREAN",
  sub_western: "WESTERN",
};

const GENRE_HINTS: Record<FoodSubCategory, string[]> = {
  CHINESE: ["중국", "중식", "짜장", "짬뽕", "마라", "중화"],
  JAPANESE: ["일식", "초밥", "돈까스", "라멘", "스시", "오마카세"],
  KOREAN: ["한식", "국밥", "찌개", "김치", "한정식"],
  WESTERN: ["양식", "파스타", "피자", "스테이크", "브런치"],
  FASTFOOD: ["버거", "패스트", "프랜차이즈"],
};

function blobHit(blob: string, hints: string[]): boolean {
  return hints.some((h) => blob.includes(h.toLowerCase()));
}

function foodPreferenceFit(blob: string, prefs: string[] | undefined): number {
  if (!prefs?.length) return 0;
  let hit = 0;
  for (const p of prefs) {
    const hints = PREF_HINTS[p];
    if (hints && blobHit(blob, hints)) hit += 1;
  }
  return hit > 0 ? Math.min(100, (hit / prefs.length) * 100) : 0;
}

function vibePreferenceFit(blob: string, vibes: string[] | undefined): number {
  if (!vibes?.length) return 0;
  let hit = 0;
  for (const v of vibes) {
    const hints = VIBE_HINTS[v];
    if (hints && blobHit(blob, hints)) hit += 1;
  }
  return hit > 0 ? Math.min(100, (hit / vibes.length) * 100) : 0;
}

function softConstraintFit(blob: string, soft: string[] | undefined): number {
  if (!soft?.length) return 0;
  let hit = 0;
  for (const s of soft) {
    const hints = SOFT_HINTS[s];
    if (hints && blobHit(blob, hints)) hit += 1;
  }
  return hit > 0 ? Math.min(100, (hit / soft.length) * 100) : 25;
}

function timeOfDayFit(blob: string, tod: ScenarioObject["timeOfDay"]): number {
  if (!tod) return 50;
  const m: Record<string, RegExp> = {
    morning: /아침|브런치|모닝/,
    lunch: /점심|런치|한끼/,
    afternoon: /오후|티타임/,
    dinner: /저녁|디너/,
    night: /야식|밤|심야|술안/,
  };
  const re = m[tod];
  if (!re) return 50;
  return re.test(blob) ? 100 : 35;
}

function rankKeyForCompositeFit(parsed: ScenarioObject): RecommendScenarioKey | null {
  if (parsed.scenario === "parents") return "family";
  const k = scenarioTypeToRankKey(parsed.scenario);
  if (parsed.scenario === "generic") return null;
  return k;
}

function scenarioFitRaw(card: HomeCard, parsed: ScenarioObject): number {
  const key = rankKeyForCompositeFit(parsed);
  if (!key) return 35;
  const blob = placeTextBlob(card);
  let sum = 0;
  for (const rule of SCENARIO_TAG_RULES[key]) {
    if (rule.patterns.some((re) => re.test(blob))) sum += rule.weight;
  }
  const c = card as any;
  if (key === "family" && c?.with_kids === true) sum += 20;
  if (parsed.withParents && /한정식|상견례|룸|가족/.test(blob)) sum += 18;
  if (key === "solo" && c?.for_work === true) sum += 12;
  if (key === "group" && c?.reservation_required === true) sum += 14;
  const cap = (SCENARIO_RAW_CAP[key] || 1) + 45;
  return Math.min(100, (sum / cap) * 100);
}

/**
 * 하드 제약 위반 시 true(후보 제외). 평가 가능한 경우만 적용.
 */
export function violatesHardConstraints(card: HomeCard, parsed: ScenarioObject): boolean {
  const hard = parsed.hardConstraints ?? [];
  if (!hard.length) return false;

  const cat = String(card.category ?? "").toLowerCase();
  const blob = placeTextBlob(card);

  if (hard.includes("indoor")) {
    if (/야외\s*전용|야외에서만|오픈에어만/.test(blob)) return true;
  }
  if (hard.includes("category_cafe") && cat !== "cafe") return true;
  if (hard.includes("category_salon") && cat !== "salon") return true;

  for (const h of hard) {
    const wantSub = SUB_HARD[h];
    if (!wantSub) continue;
    const r = foodMenuMatchRaw(card, parsed.menuIntent, wantSub);
    if (r.hasSubHit) continue;
    if (!blobHit(blob, GENRE_HINTS[wantSub])) return true;
  }
  return false;
}

const W_SCENARIO = 25;
const W_FOOD_PREF = 20;
const W_VIBE = 20;
const W_TIME = 10;
const W_SOFT = 15;

/**
 * 시나리오·취향·시간·soft 가점 raw → 0~100 정규화(메뉴/서브는 foodIntent 쪽과 분리).
 */
export function compositeIntentRawScore(card: HomeCard, parsed: ScenarioObject): number {
  const blob = placeTextBlob(card);
  let raw = 0;
  raw += (scenarioFitRaw(card, parsed) / 100) * W_SCENARIO;
  raw += (foodPreferenceFit(blob, parsed.foodPreference) / 100) * W_FOOD_PREF;
  raw += (vibePreferenceFit(blob, parsed.vibePreference) / 100) * W_VIBE;
  raw += (timeOfDayFit(blob, parsed.timeOfDay) / 100) * W_TIME;
  raw += (softConstraintFit(blob, parsed.softConstraints) / 100) * W_SOFT;
  const max = W_SCENARIO + W_FOOD_PREF + W_VIBE + W_TIME + W_SOFT;
  return Math.min(100, (raw / max) * 100);
}

/**
 * FOOD strict 복합 랭킹 헬퍼(테스트·디버그·선행 정렬용).
 */
export function rankPlacesWithCompositeIntent(
  candidates: HomeCard[],
  parsed: ScenarioObject,
  userLat?: number | null,
  userLng?: number | null
): HomeCard[] {
  const strictFood =
    parsed.intentType === "search_strict" &&
    parsed.intentCategory === "FOOD" &&
    parsed.intentStrict !== false;

  const pool = candidates.filter((c) => !(strictFood && violatesHardConstraints(c, parsed)));

  function km(card: HomeCard): number | null {
    const lat = typeof card.lat === "number" ? card.lat : null;
    const lng = typeof card.lng === "number" ? card.lng : null;
    if (lat == null || lng == null || userLat == null || userLng == null) return null;
    const R = 6371;
    const dLat = ((userLat - lat) * Math.PI) / 180;
    const dLng = ((userLng - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((userLat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  return [...pool].sort((a, b) => {
    const foodA = strictFood
      ? foodMenuMatchNormalized(a, parsed.menuIntent, parsed.foodSubCategory)
      : 0;
    const foodB = strictFood
      ? foodMenuMatchNormalized(b, parsed.menuIntent, parsed.foodSubCategory)
      : 0;
    const mixA =
      foodA * 0.55 +
      compositeIntentRawScore(a, parsed) * 0.45 +
      foodMenuMatchRaw(a, parsed.menuIntent, parsed.foodSubCategory).raw * 0.002;
    const mixB =
      foodB * 0.55 +
      compositeIntentRawScore(b, parsed) * 0.45 +
      foodMenuMatchRaw(b, parsed.menuIntent, parsed.foodSubCategory).raw * 0.002;
    if (Math.abs(mixB - mixA) > 0.25) return mixB - mixA;
    const qa = qualityScoreFromCard(a);
    const qb = qualityScoreFromCard(b);
    if (qb !== qa) return qb - qa;
    return distanceScoreFromKm(km(b)) - distanceScoreFromKm(km(a));
  });
}
