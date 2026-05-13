import type { HomeCard } from "@/lib/storeTypes";
import type { BeautySubCategory, IntentCategory, ScenarioObject } from "@/lib/scenarioEngine/types";
import { mergeResultsScenario } from "@/lib/conversation/mergeResultsScenario";
import type { ConversationContext } from "@/lib/conversation/types";

/** URL `category` + 홈 퀵과 동일한 소문자 키 (exercise → fitness) */
export type ResultsExplicitCanonicalCategory =
  | "beauty"
  | "fitness"
  | "life"
  | "restaurant"
  | "cafe"
  | "culture"
  | "activity"
  | "mixed";

export function normalizeResultsExplicitCategory(
  raw: string | null | undefined
): ResultsExplicitCanonicalCategory | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "exercise") return "fitness";
  if (s === "salon") return "beauty";
  if (
    s === "beauty" ||
    s === "fitness" ||
    s === "life" ||
    s === "restaurant" ||
    s === "cafe" ||
    s === "culture" ||
    s === "activity" ||
    s === "mixed"
  ) {
    return s as ResultsExplicitCanonicalCategory;
  }
  return null;
}

export function canonicalCategoryToIntentCategory(
  c: ResultsExplicitCanonicalCategory
): IntentCategory | null {
  switch (c) {
    case "beauty":
      return "BEAUTY";
    case "fitness":
      return "FITNESS";
    case "life":
      return "LIFE";
    case "restaurant":
      return "FOOD";
    case "cafe":
      return "CAFE";
    case "culture":
    case "activity":
      return "ACTIVITY";
    case "mixed":
      return null;
    default:
      return null;
  }
}

/** URL `intent` → 시나리오 beautySubCategory */
export function beautySubFromUrlIntent(intent: string | null | undefined): BeautySubCategory | undefined {
  const i = (intent ?? "").trim().toLowerCase();
  if (i === "beauty_hair") return "hair";
  if (i === "beauty_nail") return "nail";
  if (i === "beauty_lash") return "eyelash";
  if (i === "beauty_waxing") return "waxing";
  return undefined;
}

function beautyTextBlob(card: HomeCard): string {
  const tags = Array.isArray(card.tags) ? card.tags.join(" ") : String(card.tags ?? "");
  return `${card.name ?? ""} ${tags} ${String(card.categoryLabel ?? "")} ${String((card as { description?: string | null }).description ?? "")}`
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** A: 업종명 — name / categoryLabel / category 문자열만 (태그·설명·reason 미사용) */
const BEAUTY_STRICT_INDUSTRY_TOKENS = [
  "미용",
  "헤어",
  "네일",
  "피부",
  "에스테틱",
  "왁싱",
  "바버",
  "속눈썹",
  "메이크업",
] as const;

/** B: DB category 정확 화이트 */
const BEAUTY_STRICT_DB_CODES = new Set(["salon", "beauty", "bk9"]);

/** 하드 리젝트 — name·categoryLabel·category·tags에 포함 시 무조건 탈락 */
const BEAUTY_STRICT_REJECT_SUBSTR = [
  "공원",
  "카페",
  "보드게임",
  "키즈",
  "박물관",
  "전시",
  "체험",
  "놀이터",
  "액티비티",
  "도서관",
  "베이커리",
  "식당",
] as const;

const BEAUTY_STRICT_DENY_DB_CATEGORY = new Set([
  "restaurant",
  "cafe",
  "fd6",
  "ce7",
  "food",
  "activity",
  "at4",
  "museum",
  "library",
  "park",
  "culture",
  "gallery",
  "exhibition",
  "coffee",
  "meal",
]);

function normalizeBeautyStrictChunk(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export type BeautyStrictWhitelistEval =
  | { ok: true; passKind: "A" | "B" }
  | { ok: false; reason: string };

/**
 * 뷰티 완전 화이트리스트: (A 업종 토큰이 name·categoryLabel·category 중 하나에 있음) OR (B DB 코드 salon|beauty|bk9).
 * 통과 판정에 태그·설명·reasonText 미사용. 리젝트는 태그까지 스캔(보드게임카페 등).
 */
export function evaluateBeautyStrictWhitelist(card: HomeCard): BeautyStrictWhitelistEval {
  const name = String(card.name ?? "");
  const label = String(card.categoryLabel ?? "");
  const rawCat = String((card as any)?.category ?? "").trim().toLowerCase();
  const tags = Array.isArray(card.tags) ? card.tags.join(" ") : String(card.tags ?? "");

  const rejectHaystack = normalizeBeautyStrictChunk(`${name} ${label} ${rawCat} ${tags}`);
  for (const tok of BEAUTY_STRICT_REJECT_SUBSTR) {
    const t = tok.toLowerCase();
    if (rejectHaystack.includes(t)) {
      return { ok: false, reason: `hard_reject:${tok}` };
    }
  }

  if (BEAUTY_STRICT_DENY_DB_CATEGORY.has(rawCat)) {
    return { ok: false, reason: `deny_db_category:${rawCat}` };
  }

  if (BEAUTY_STRICT_DB_CODES.has(rawCat)) {
    return { ok: true, passKind: "B" };
  }

  const allowHaystack = normalizeBeautyStrictChunk(`${name} ${label} ${rawCat}`);
  for (const tok of BEAUTY_STRICT_INDUSTRY_TOKENS) {
    const t = tok.toLowerCase();
    if (allowHaystack.includes(t)) {
      return { ok: true, passKind: "A" };
    }
  }

  return { ok: false, reason: "beauty_strict_neither_A_nor_B" };
}

/** 카페·키즈·식음료·문화·공원 등 — `evaluateBeautyStrictWhitelist`와 동일 기준 */
export function beautyVerticalHardReject(card: HomeCard): boolean {
  return !evaluateBeautyStrictWhitelist(card).ok;
}

/**
 * @deprecated `beautyVerticalHardReject`를 사용하세요.
 */
export function beautyWrongVerticalStrongSignal(card: HomeCard): boolean {
  return beautyVerticalHardReject(card);
}

export type BeautyIndustryWhitelistExplain = { ok: boolean; reason: string };

/**
 * 뷰티 후보: `evaluateBeautyStrictWhitelist` — 업종명(A) 또는 DB 코드(B)만 허용.
 */
export function explainBeautyIndustryWhitelist(card: HomeCard): BeautyIndustryWhitelistExplain {
  const ev = evaluateBeautyStrictWhitelist(card);
  if (ev.ok) {
    return { ok: true, reason: ev.passKind === "A" ? "beauty_strict_A" : "beauty_strict_B" };
  }
  return { ok: false, reason: ev.reason };
}

export function passesBeautyIndustryWhitelist(card: HomeCard): boolean {
  return explainBeautyIndustryWhitelist(card).ok;
}

/** A: 문화 시설 키워드 — name / categoryLabel / category 문자열만 */
const CULTURE_STRICT_INDUSTRY_TOKENS = [
  "박물관",
  "미술관",
  "전시관",
  "도서관",
  "문화센터",
  "역사관",
  "기념관",
  "과학관",
  "체험관",
  "아트",
  "갤러리",
  "문화",
  "공연",
  "전시",
] as const;

/** B: DB category 코드 */
const CULTURE_STRICT_DB_CODES = new Set([
  "culture",
  "museum",
  "library",
  "exhibition",
  "gallery",
]);

const CULTURE_STRICT_REJECT_SUBSTR = [
  "식당",
  "카페",
  "보쌈",
  "부대찌개",
  "치킨",
  "고기",
  "국밥",
  "술집",
  "보드게임카페",
  "키즈카페",
] as const;

const CULTURE_STRICT_DENY_DB_CATEGORY = new Set([
  "restaurant",
  "cafe",
  "fd6",
  "ce7",
  "food",
  "coffee",
  "meal",
  "salon",
  "beauty",
  "bk9",
]);

function normalizeCultureStrictChunk(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export type CultureStrictWhitelistEval =
  | { ok: true; passKind: "A" | "B" }
  | { ok: false; reason: string };

/**
 * 문화 URL / 문화형 activity_general 전용: 식당·카페 등 하드 차단 후
 * (A 업종 토큰 in name·categoryLabel·category·tags) OR (B DB 코드 culture|museum|library|exhibition|gallery).
 */
export function evaluateCultureStrictWhitelist(card: HomeCard): CultureStrictWhitelistEval {
  const name = String(card.name ?? "");
  const label = String(card.categoryLabel ?? "");
  const rawCat = String((card as { category?: string | null }).category ?? "").trim().toLowerCase();
  const tags = Array.isArray(card.tags) ? card.tags.join(" ") : String(card.tags ?? "");

  const rejectHaystack = normalizeCultureStrictChunk(`${name} ${label} ${rawCat} ${tags}`);
  for (const tok of CULTURE_STRICT_REJECT_SUBSTR) {
    const t = tok.toLowerCase();
    if (rejectHaystack.includes(t)) {
      return { ok: false, reason: `hard_reject:${tok}` };
    }
  }

  if (CULTURE_STRICT_DENY_DB_CATEGORY.has(rawCat)) {
    return { ok: false, reason: `deny_db_category:${rawCat}` };
  }

  if (CULTURE_STRICT_DB_CODES.has(rawCat)) {
    return { ok: true, passKind: "B" };
  }

  const allowHaystack = normalizeCultureStrictChunk(`${name} ${label} ${rawCat} ${tags}`);
  for (const tok of CULTURE_STRICT_INDUSTRY_TOKENS) {
    const t = tok.toLowerCase();
    if (allowHaystack.includes(t)) {
      return { ok: true, passKind: "A" };
    }
  }

  return { ok: false, reason: "culture_strict_neither_A_nor_B" };
}

export function passesCultureIndustryWhitelist(card: HomeCard): boolean {
  return evaluateCultureStrictWhitelist(card).ok;
}

/**
 * 보조 텍스트 신호 — `passesBeautyIndustryWhitelist`가 true일 때만 의미 있음.
 * 게이트로 단독 사용하지 말 것(일반 "관리/케어" 오탐 방지).
 */
export function salonLikeFromLabelsAndBlob(card: HomeCard): boolean {
  if (!passesBeautyIndustryWhitelist(card)) return false;
  const b = beautyTextBlob(card);
  return /(펌|염색|커트|젤네일|두피|클리닉|스파|바버|nail|wax|lash|헤어|네일)/i.test(b);
}

/**
 * /results: URL `category`·`intent`를 시나리오 strict intentCategory와 정렬 (mergeResultsScenario 위에 오버레이).
 */
export function strictExplicitGateCategoryFromUrl(
  explicitCategory: string | null | undefined,
  explicitIntent: string | null | undefined
): "life" | "culture" | "fitness" | "beauty" | null {
  const i = (explicitIntent ?? "").trim().toLowerCase();
  if (i.startsWith("beauty_")) return "beauty";
  const canon = normalizeResultsExplicitCategory(explicitCategory);
  if (canon === "life" || canon === "culture" || canon === "fitness" || canon === "beauty") return canon;
  return null;
}

export function mergeResultsScenarioWithExplicitNav(
  qRaw: string,
  convCtx: ConversationContext | null,
  urlCategory: string | null | undefined,
  urlIntent: string | null | undefined
): ScenarioObject | null {
  const base = mergeResultsScenario(qRaw, convCtx);
  const canon = normalizeResultsExplicitCategory(urlCategory);
  if (!base || !canon) return base;
  const ic = canonicalCategoryToIntentCategory(canon);
  if (!ic) return base;

  const beautySub = canon === "beauty" ? beautySubFromUrlIntent(urlIntent) : undefined;
  return {
    ...base,
    intentType: "search_strict",
    intentCategory: ic,
    intentStrict: true,
    ...(beautySub ? { beautySubCategory: beautySub } : {}),
  };
}
