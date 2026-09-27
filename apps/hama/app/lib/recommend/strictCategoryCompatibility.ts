/**
 * Filter Composition v1.1 — purpose-gated strict intent-category compatibility.
 * KEEP/DROP only. No score boost. Does not change search_strict routing.
 * Menu protection requires food-qualified menu evidence (not any menuIntent token).
 */
import type { HomeCard } from "@/lib/storeTypes";
import type { IntentCategory, ScenarioObject } from "@/lib/scenarioEngine/types";
import { storeCategoryMatchesIntentCategory } from "@/lib/scenarioEngine/intentClassification";
import { cardViolatesHardNegation } from "@/lib/scenarioEngine/negationUnderstanding";
import { detectMenuIntent, hasAnyFoodSubKeyword } from "@/lib/scenarioEngine/foodIntent";
import { SEARCH_SYNONYM_GROUPS } from "@/lib/searchSynonyms";
import { getCatalogMenuLexicon } from "./catalogMenuLexicon";
import { resolveMenuIntentsForMatch } from "./menuRelevance";
import { isKidFocusedVenue } from "./kidVenueSignals";

const GENERIC_PURPOSES = new Set(["dining"]);

/** Purposes that can justify a cross-category KEEP. FOOD-internal purposes are excluded. */
const COMPATIBLE_PURPOSES = new Set([
  "culture",
  "brunch",
  "dessert",
  "play",
  "indoor_play",
  "kids_cafe",
]);

const CAFE_LEANING_MENUS = new Set(["브런치", "디저트"]);
const ACTIVITY_LEANING_MENUS = new Set(["키즈카페"]);

/** Same kids-cafe token as queryUnderstanding (not a new classifier). */
const KIDS_CAFE_PLACE = /키즈\s*카페|키즈카페|놀이카페|키즈룸/;
/** Place-noun cafe request; 커피/디저트 alone is not an explicit cafe place. */
const CAFE_PLACE_NOUN = /카페/;
/** Same restaurant place tokens as queryUnderstanding.EXPLICIT_RESTAURANT. */
const RESTAURANT_PLACE =
  /식당|레스토랑|맛집|밥집|고깃집|고기집|외식|회식/;

export type MenuProtectionDebug = {
  resolvedMenuIntents: string[];
  foodQualifiedMenuIntents: string[];
  rejectedNonFoodMenuIntents: string[];
  hasStrongPrimaryMenu: boolean;
  protectionApplied: boolean;
};

export const EMPTY_MENU_PROTECTION: MenuProtectionDebug = {
  resolvedMenuIntents: [],
  foodQualifiedMenuIntents: [],
  rejectedNonFoodMenuIntents: [],
  hasStrongPrimaryMenu: false,
  protectionApplied: false,
};

export type StrictCategoryCompatibilityDebug = {
  baseCategoryMatch: boolean;
  compatibilityApplied: boolean;
  compatibilityReason: string;
  purposeSignals: string[];
  candidateEvidence: string[];
  explicitCategoryProtected: boolean;
  menuProtected: boolean;
  negationBlocked: boolean;
  menuProtection: MenuProtectionDebug;
  finalDecision: "KEEP" | "DROP";
};

function uniq(xs: string[]): string[] {
  return [...new Set(xs.map((x) => String(x ?? "").trim()).filter(Boolean))];
}

function catOf(card: HomeCard): string {
  return String(card.category ?? "").toLowerCase().trim();
}

/** Candidate text + catalog metadata actually present on stores (name/tags/category/search_keywords). */
export function compatibilityEvidenceBlob(card: HomeCard): string {
  const c = card as HomeCard & { categoryLabel?: string | null; search_keywords?: string[] | null };
  return [
    c.name,
    c.category,
    c.categoryLabel,
    c.description,
    ...(c.tags ?? []),
    ...(c.mood ?? []),
    ...(c.menu_keywords ?? []),
    ...(c.search_keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function secondaryPositivePurposes(parsed: ScenarioObject | null | undefined): string[] {
  if (!parsed) return [];
  const out: string[] = [];
  for (const p of parsed.queryUnderstanding?.purposeIntents ?? []) {
    if (GENERIC_PURPOSES.has(p)) continue;
    if (!COMPATIBLE_PURPOSES.has(p)) continue;
    out.push(p);
  }
  if (parsed.activityLevel === "active" && !out.includes("play")) out.push("play");
  return uniq(out);
}

export function queryHasExplicitCafePlace(raw: string): boolean {
  const q = String(raw ?? "");
  if (!CAFE_PLACE_NOUN.test(q)) return false;
  if (KIDS_CAFE_PLACE.test(q)) return false;
  return true;
}

export function queryHasExplicitRestaurantPlace(raw: string): boolean {
  return RESTAURANT_PLACE.test(String(raw ?? ""));
}

function queryText(parsed: ScenarioObject, searchQuery?: string | null): string {
  return `${parsed.rawQuery ?? ""} ${searchQuery ?? ""}`;
}

function compactMenuTerm(term: string): string {
  return String(term ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/\s+/g, "");
}

function isCafeOrActivityLeaningMenu(term: string): boolean {
  return CAFE_LEANING_MENUS.has(term) || ACTIVITY_LEANING_MENUS.has(term);
}

/** Exact membership in SEARCH_SYNONYM_GROUPS keys or members — no substring expansion. */
function isSynonymFoodTerm(term: string): boolean {
  const c = compactMenuTerm(term);
  if (c.length < 2) return false;
  for (const [key, vals] of Object.entries(SEARCH_SYNONYM_GROUPS)) {
    if (compactMenuTerm(key) === c) return true;
    if (vals.some((v) => compactMenuTerm(v) === c)) return true;
  }
  return false;
}

/**
 * Existing FOOD-menu SSoT: detectMenuIntent patterns, SEARCH_SYNONYM_GROUPS,
 * FOOD_SUB_RULES hints, and catalog FOOD_MENU entries with menu-keyword evidence.
 * Companion / context tokens are not food-qualified.
 */
export function isFoodQualifiedMenuTerm(term: string): boolean {
  const t = String(term ?? "").trim();
  if (t.length < 2) return false;
  if (detectMenuIntent(t).length > 0) return true;
  if (isSynonymFoodTerm(t)) return true;
  if (hasAnyFoodSubKeyword(t)) return true;
  const lex = getCatalogMenuLexicon();
  if (lex) {
    const c = compactMenuTerm(t);
    const entry = lex.entries.find((e) => e.normalizedTerm === c);
    if (entry && entry.kind === "FOOD_MENU" && entry.menuKeywordStoreCount >= 1) return true;
  }
  return false;
}

export function qualifyMenuProtection(
  parsed: ScenarioObject,
  searchQuery?: string | null
): MenuProtectionDebug {
  const resolvedMenuIntents = resolveMenuIntentsForMatch(parsed.menuIntent, searchQuery ?? parsed.rawQuery);
  const foodQualifiedMenuIntents: string[] = [];
  const rejectedNonFoodMenuIntents: string[] = [];
  for (const m of resolvedMenuIntents) {
    if (isCafeOrActivityLeaningMenu(m) || !isFoodQualifiedMenuTerm(m)) {
      rejectedNonFoodMenuIntents.push(m);
      continue;
    }
    foodQualifiedMenuIntents.push(m);
  }
  const hasStrongPrimaryMenu = foodQualifiedMenuIntents.length > 0;
  return {
    resolvedMenuIntents,
    foodQualifiedMenuIntents,
    rejectedNonFoodMenuIntents,
    hasStrongPrimaryMenu,
    protectionApplied: hasStrongPrimaryMenu,
  };
}

export function candidateStronglyMatchesPurpose(
  purpose: string,
  card: HomeCard
): { matched: boolean; evidence: string[] } {
  const blob = compatibilityEvidenceBlob(card);
  const cat = catOf(card);
  switch (purpose) {
    case "culture": {
      const evidence: string[] = [];
      if (/도서관|library/.test(blob) || cat === "library") evidence.push("reading-venue");
      if (/박물관|미술관|과학관|museum|gallery/.test(blob) || cat === "museum" || cat === "gallery") {
        evidence.push("museum-gallery");
      }
      if (/전시|exhibition/.test(blob) || cat === "exhibition") evidence.push("exhibition");
      return { matched: evidence.length > 0, evidence };
    }
    case "brunch": {
      if (/브런치/.test(blob)) return { matched: true, evidence: ["brunch"] };
      return { matched: false, evidence: [] };
    }
    case "dessert": {
      if (/디저트|케이크|케익|베이커리|빵집|마카롱/.test(blob) || cat === "cafe") {
        return { matched: true, evidence: ["dessert"] };
      }
      return { matched: false, evidence: [] };
    }
    case "play":
    case "indoor_play": {
      if (cat === "activity" || /놀이|체험|키즈/.test(blob)) {
        return { matched: true, evidence: [purpose] };
      }
      return { matched: false, evidence: [] };
    }
    case "kids_cafe": {
      if (isKidFocusedVenue(card) || /키즈카페|놀이카페/.test(blob)) {
        return { matched: true, evidence: ["kids_cafe"] };
      }
      return { matched: false, evidence: [] };
    }
    default:
      return { matched: false, evidence: [] };
  }
}

function purposeViolatesCardKind(purpose: string, card: HomeCard): boolean {
  const cat = catOf(card);
  if (purpose === "culture") {
    if (cat === "restaurant" || cat === "salon" || cat === "fd6") return true;
    if (cat === "cafe" && !/도서관|박물관|미술관|전시|library|museum|gallery/.test(compatibilityEvidenceBlob(card))) {
      return true;
    }
  }
  if ((purpose === "brunch" || purpose === "dessert") && cat === "activity") return true;
  if ((purpose === "play" || purpose === "indoor_play" || purpose === "kids_cafe") && cat === "restaurant") {
    return true;
  }
  return false;
}

function emptyDebug(partial: Partial<StrictCategoryCompatibilityDebug> & { finalDecision: "KEEP" | "DROP" }): StrictCategoryCompatibilityDebug {
  return {
    baseCategoryMatch: false,
    compatibilityApplied: false,
    compatibilityReason: "",
    purposeSignals: [],
    candidateEvidence: [],
    explicitCategoryProtected: false,
    menuProtected: false,
    negationBlocked: false,
    menuProtection: EMPTY_MENU_PROTECTION,
    ...partial,
  };
}

const COMPAT_ROUTES: ReadonlySet<IntentCategory> = new Set(["ACTIVITY", "CAFE"]);

export function evaluateStrictCategoryCompatibility(
  card: HomeCard,
  parsed: ScenarioObject | null | undefined,
  searchQuery?: string | null
): StrictCategoryCompatibilityDebug {
  if (!parsed || parsed.intentType !== "search_strict" || !parsed.intentCategory || parsed.intentStrict === false) {
    return emptyDebug({
      compatibilityReason: "not-strict",
      finalDecision: "KEEP",
    });
  }

  const menuProtection = qualifyMenuProtection(parsed, searchQuery);
  const menuProtected = menuProtection.hasStrongPrimaryMenu;

  const baseCategoryMatch = storeCategoryMatchesIntentCategory(card, parsed.intentCategory);
  if (baseCategoryMatch) {
    return emptyDebug({
      baseCategoryMatch: true,
      compatibilityReason: "base-category-match",
      menuProtection,
      finalDecision: "KEEP",
    });
  }

  const negation = parsed.queryUnderstanding?.negation;
  if (cardViolatesHardNegation(card, negation)) {
    return emptyDebug({
      baseCategoryMatch: false,
      negationBlocked: true,
      compatibilityReason: "negation-blocked",
      menuProtection,
      finalDecision: "DROP",
    });
  }

  const q = queryText(parsed, searchQuery);
  const purposes = secondaryPositivePurposes(parsed);
  const explicitCafe = queryHasExplicitCafePlace(q);
  const explicitRestaurant = queryHasExplicitRestaurantPlace(q);
  const routeOk = COMPAT_ROUTES.has(parsed.intentCategory);

  if (explicitCafe && parsed.intentCategory === "CAFE") {
    return emptyDebug({
      explicitCategoryProtected: true,
      purposeSignals: purposes,
      compatibilityReason: "explicit-cafe-protected",
      menuProtection,
      finalDecision: "DROP",
    });
  }
  if (explicitRestaurant && parsed.intentCategory === "FOOD") {
    return emptyDebug({
      explicitCategoryProtected: true,
      purposeSignals: purposes,
      compatibilityReason: "explicit-restaurant-protected",
      menuProtection,
      finalDecision: "DROP",
    });
  }

  if (menuProtected) {
    return emptyDebug({
      menuProtected: true,
      purposeSignals: purposes,
      compatibilityReason: "menu-protected",
      menuProtection,
      finalDecision: "DROP",
    });
  }

  if (!routeOk || purposes.length === 0) {
    return emptyDebug({
      purposeSignals: purposes,
      compatibilityReason: purposes.length === 0 ? "no-secondary-purpose" : "route-not-compatible",
      menuProtection,
      finalDecision: "DROP",
    });
  }

  const evidence: string[] = [];
  const matchedPurposes: string[] = [];
  for (const purpose of purposes) {
    if (purposeViolatesCardKind(purpose, card)) continue;
    const hit = candidateStronglyMatchesPurpose(purpose, card);
    if (hit.matched) {
      matchedPurposes.push(purpose);
      evidence.push(...hit.evidence);
    }
  }

  if (matchedPurposes.length === 0) {
    return emptyDebug({
      purposeSignals: purposes,
      compatibilityReason: "weak-purpose-evidence",
      menuProtection,
      finalDecision: "DROP",
    });
  }

  return {
    baseCategoryMatch: false,
    compatibilityApplied: true,
    compatibilityReason: `purpose-compatible:${matchedPurposes.join(",")}`,
    purposeSignals: purposes,
    candidateEvidence: uniq(evidence),
    explicitCategoryProtected: false,
    menuProtected: false,
    negationBlocked: false,
    menuProtection,
    finalDecision: "KEEP",
  };
}

export function strictIntentCategoryAllowsCard(
  card: HomeCard,
  parsed: ScenarioObject | null | undefined,
  searchQuery?: string | null
): boolean {
  return evaluateStrictCategoryCompatibility(card, parsed, searchQuery).finalDecision === "KEEP";
}
