import type { HomeCard } from "@/lib/storeTypes";
import type { FoodSubCategory, ScenarioObject } from "@/lib/scenarioEngine/types";
import { FOOD_SUB_RULES } from "@/lib/scenarioEngine/foodIntent";
import { distanceScoreFromKm, qualityScoreFromCard } from "./scoreParts";

function normBlob(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normToken(s: string): string {
  return normBlob(s).replace(/\s+/g, "");
}

export function placeTextBlob(card: HomeCard): string {
  const c = card as any;
  const parts: string[] = [];
  if (c?.name) parts.push(String(c.name));
  if (Array.isArray(c?.menu_keywords)) parts.push((c.menu_keywords as string[]).join(" "));
  if (Array.isArray(c?.tags)) parts.push(c.tags.join(" "));
  if (typeof c?.description === "string") parts.push(c.description);
  if (Array.isArray(c?.mood)) parts.push(c.mood.join(" "));
  return parts.join(" ").toLowerCase().replace(/\s+/g, " ").trim();
}

function readPlaceFoodSub(card: HomeCard): FoodSubCategory | null {
  const raw = (card as any).food_sub_category ?? (card as any).foodSubCategory;
  if (typeof raw === "string") {
    const u = raw.toUpperCase() as FoodSubCategory;
    if (FOOD_SUB_RULES.some((r) => r.sub === u)) return u;
  }
  const blob = placeTextBlob(card);
  if (!blob) return null;
  let best: FoodSubCategory | null = null;
  let bestN = 0;
  for (const { sub, hints } of FOOD_SUB_RULES) {
    let n = 0;
    for (const h of hints) {
      if (blob.includes(h.toLowerCase())) n += 1;
    }
    if (n > bestN) {
      bestN = n;
      best = sub;
    }
  }
  return bestN > 0 ? best : null;
}

/** 랭킹·필터용: 카드 텍스트/DB에서 음식 서브 추론 */
export function inferPlaceFoodSub(card: HomeCard): FoodSubCategory | null {
  return readPlaceFoodSub(card);
}

const CHINESE_MENU_NAMES = new Set([
  "짜장면",
  "짬뽕",
  "마라탕",
  "마라샹궈",
  "탕수육",
  "훠궈",
  "짜장",
]);

/** 태그 오염을 덜 타는 문자열: 이름·설명·메뉴키워드 (tags 제외) */
function placeIdentityFoodBlob(card: HomeCard): string {
  const c = card as any;
  const name = String(c?.name ?? "");
  const desc = typeof c?.description === "string" ? c.description : "";
  const mk = Array.isArray(c?.menu_keywords) ? (c.menu_keywords as string[]).join(" ") : "";
  return `${name} ${desc} ${mk}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 중식 의도인데 상호/소개/메뉴로 보면 한식·양식·버거·일식이 분명한 경우.
 * (DB tags에만 '중식'이 박혀 있으면 오탐 → tags 는 쓰지 않음)
 */
function isObviousNonChineseByIdentity(card: HomeCard): boolean {
  const q = placeIdentityFoodBlob(card);
  if (!q) return false;

  const koreanSignals =
    /국밥|찌개|된장|김치찌개|삼겹|갈비|한우|비빔|백반|한정식|냉면|칼국수|수육|보쌈|족발|쌈밥|순두부|들깨|해장|전골|샤브|능이|밥상|한식/;
  const westernOrBurger =
    /버거|햄버거|burger|패티|프라이|파스타|피자|스테이크|브런치|양식|오마카세|마카세|immaka|이탈리|멕시칸|멕시코/;
  const japanese =
    /초밥|스시|돈까스|돈카츠|라멘|우동|오므라이스|이자카야|일식|일본/;
  const cafeOnly = /^[^\n]*카페[^\n]*$/i.test(String((card as any).name ?? "").trim()) && !/중식|중국|짜장|마라/.test(q);

  return koreanSignals.test(q) || westernOrBurger.test(q) || japanese.test(q) || cafeOnly;
}

function userWantsChineseFood(
  parsed: Pick<ScenarioObject, "foodSubCategory" | "menuIntent">
): boolean {
  if (parsed.foodSubCategory === "CHINESE") return true;
  const menus = parsed.menuIntent ?? [];
  return menus.some((m) => CHINESE_MENU_NAMES.has(m));
}

/**
 * search_strict + FOOD: 메뉴/서브/이름·태그에 음식 장르 신호가 있을 때만 통과.
 * (완화 랭킹 패스가 한식집에도 '중식·짜장면' 배지를 붙이던 문제 방지)
 */
export function cardMatchesStrictFoodIntent(
  card: HomeCard,
  parsed: Pick<
    ScenarioObject,
    "intentCategory" | "intentType" | "intentStrict" | "foodSubCategory" | "menuIntent"
  >
): boolean {
  if (
    parsed.intentCategory !== "FOOD" ||
    parsed.intentType !== "search_strict" ||
    parsed.intentStrict === false
  ) {
    return true;
  }
  const menus = (parsed.menuIntent ?? []).filter(Boolean);
  const sub = parsed.foodSubCategory ?? null;
  if (!menus.length && !sub) return true;

  const wantsChinese = userWantsChineseFood(parsed);
  if (wantsChinese && isObviousNonChineseByIdentity(card)) {
    return false;
  }

  const menuMatch = foodMenuMatchRaw(card, menus, sub);
  if (menuMatch.hasSubHit) return true;

  if (wantsChinese) {
    const fromStructuredMenu = menus.some(
      (m) => menuInMenuKeywords(card, m) || menuInDescription(card, m)
    );
    if (fromStructuredMenu) return true;
  } else if (menuMatch.hasMenuHit) {
    return true;
  }

  if (!wantsChinese) {
    const dominant = readPlaceFoodSub(card);
    if (sub && dominant && dominant !== sub) {
      return false;
    }
  }

  if (sub) {
    const blob =
      wantsChinese && sub === "CHINESE"
        ? placeIdentityFoodBlob(card)
        : placeTextBlob(card);
    if (blob) {
      const rule = FOOD_SUB_RULES.find((r) => r.sub === sub);
      if (rule) {
        let hintHits = 0;
        for (const h of rule.hints) {
          if (blob.includes(String(h).toLowerCase())) hintHits += 1;
        }
        const strongChinese =
          /중국집|중화요리|중화\s|마라탕|짜장면|짬뽕|훠궈|양꼬치/.test(blob);
        if (hintHits >= 2) return true;
        if (hintHits === 1 && strongChinese) return true;
      }
    }
  }

  return false;
}

function menuInMenuKeywords(card: HomeCard, menu: string): boolean {
  const mk = (card as any).menu_keywords;
  if (!Array.isArray(mk)) return false;
  const t = normToken(menu);
  return mk.some((x: unknown) => normToken(String(x)).includes(t) || t.includes(normToken(String(x))));
}

function menuInTags(card: HomeCard, menu: string): boolean {
  const tags = (card as any).tags;
  if (!Array.isArray(tags)) return false;
  const t = normToken(menu);
  return tags.some((x: unknown) => normToken(String(x)).includes(t) || t.includes(normToken(String(x))));
}

function menuInDescription(card: HomeCard, menu: string): boolean {
  const d = (card as any).description;
  if (typeof d !== "string") return false;
  return normToken(d).includes(normToken(menu)) || normBlob(d).includes(normBlob(menu));
}

/** 가이드: menu_keywords 40, tags 35, description 20 — 메뉴마다 한 채널만 반영 */
const SCORE_MENU_KEYWORD = 40;
const SCORE_MENU_TAG = 35;
const SCORE_MENU_DESC = 20;
const SCORE_SUB_MATCH = 30;

/**
 * 단일 장소에 대한 음식 의도 매칭 raw 점수. 정규화는 {@link foodMenuMatchNormalized}.
 */
export function foodMenuMatchRaw(
  card: HomeCard,
  menuIntent: string[] | undefined | null,
  foodSubCategory: FoodSubCategory | undefined | null
): { raw: number; hasMenuHit: boolean; hasSubHit: boolean } {
  const menus = (menuIntent ?? []).filter(Boolean);
  let raw = 0;
  let hasMenuHit = false;
  let hasSubHit = false;

  for (const menu of menus) {
    let best = 0;
    if (menuInMenuKeywords(card, menu)) best = Math.max(best, SCORE_MENU_KEYWORD);
    if (menuInTags(card, menu)) best = Math.max(best, SCORE_MENU_TAG);
    if (menuInDescription(card, menu)) best = Math.max(best, SCORE_MENU_DESC);
    if (best > 0) hasMenuHit = true;
    raw += best;
  }

  const placeSub = readPlaceFoodSub(card);
  if (foodSubCategory && placeSub === foodSubCategory) {
    hasSubHit = true;
    raw += SCORE_SUB_MATCH;
  }

  return { raw, hasMenuHit, hasSubHit };
}

export function foodMenuMatchNormalized(
  card: HomeCard,
  menuIntent: string[] | undefined | null,
  foodSubCategory: FoodSubCategory | undefined | null
): number {
  const { raw } = foodMenuMatchRaw(card, menuIntent, foodSubCategory);
  const menuCap = Math.max(1, (menuIntent?.length ?? 0)) * SCORE_MENU_KEYWORD;
  const cap = menuCap + (foodSubCategory ? SCORE_SUB_MATCH : 0);
  return Math.min(100, Math.round((raw / cap) * 100));
}

type FoodFilterParsed = Pick<ScenarioObject, "intentCategory" | "menuIntent" | "foodSubCategory">;

function isRestaurant(card: HomeCard): boolean {
  return String(card.category ?? "").toLowerCase() === "restaurant";
}

/**
 * search_strict + FOOD: 메뉴·서브 신호 있는 곳을 앞에 두고, 같은 FOOD(restaurant) 안에서만 섞는다.
 */
export function filterFoodCandidatesByMenuIntent(
  candidates: HomeCard[],
  parsed: FoodFilterParsed
): HomeCard[] {
  const restaurants = candidates.filter(isRestaurant);
  if (parsed.intentCategory !== "FOOD" || restaurants.length === 0) return candidates;

  const menus = parsed.menuIntent ?? [];
  const sub = parsed.foodSubCategory ?? null;
  if (menus.length === 0 && !sub) return candidates;

  const scored = restaurants.map((c) => ({
    card: c,
    ...foodMenuMatchRaw(c, menus, sub),
  }));

  const anyMenuTier = menus.length > 0 ? scored.some((s) => s.hasMenuHit) : true;
  const anySubTier = sub ? scored.some((s) => s.hasSubHit) : true;

  const tierOf = (s: (typeof scored)[number]): number => {
    if (menus.length > 0) {
      if (!anyMenuTier) return 0;
      return s.hasMenuHit ? 0 : 1;
    }
    if (sub) {
      if (!anySubTier) return 0;
      return s.hasSubHit ? 0 : 1;
    }
    return 0;
  };

  const sorted = [...scored].sort((a, b) => {
    const ta = tierOf(a);
    const tb = tierOf(b);
    if (ta !== tb) return ta - tb;
    return b.raw - a.raw;
  });

  return sorted.map((s) => s.card);
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function kmToCard(card: HomeCard, userLat?: number | null, userLng?: number | null): number | null {
  const lat = typeof card.lat === "number" ? card.lat : null;
  const lng = typeof card.lng === "number" ? card.lng : null;
  if (lat == null || lng == null) return null;
  if (userLat == null || userLng == null) return null;
  return haversineKm({ lat: userLat, lng: userLng }, { lat, lng });
}

/**
 * 음식 후보만 대상으로 한 정렬 키 (메뉴 → 서브 → 품질 → 거리).
 * UI 파이프라인과 동일 우선순위를 테스트·디버그할 때 사용.
 */
export function rankFoodPlaces(
  candidates: HomeCard[],
  parsed: ScenarioObject,
  userLat?: number | null,
  userLng?: number | null
): HomeCard[] {
  const pool =
    parsed.intentCategory === "FOOD"
      ? filterFoodCandidatesByMenuIntent(candidates, parsed)
      : candidates.filter(isRestaurant);

  return [...pool].sort((a, b) => {
    const ra = foodMenuMatchRaw(a, parsed.menuIntent, parsed.foodSubCategory).raw;
    const rb = foodMenuMatchRaw(b, parsed.menuIntent, parsed.foodSubCategory).raw;
    if (rb !== ra) return rb - ra;
    const qa = qualityScoreFromCard(a);
    const qb = qualityScoreFromCard(b);
    if (qb !== qa) return qb - qa;
    const ka = kmToCard(a, userLat, userLng);
    const kb = kmToCard(b, userLat, userLng);
    return distanceScoreFromKm(kb) - distanceScoreFromKm(ka);
  });
}
