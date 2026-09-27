/**
 * Secondary constraint scoring (PURPOSE + COMPANION only).
 * Soft adjustment on top of Ranking v2. Does not filter or change base weights.
 */
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { placeTextBlob } from "./foodIntentRanking";
import { childFriendlyScore, isAlcoholNightlifeVenue } from "./childFriendlyScore";
import { isKidFocusedVenue } from "./kidVenueSignals";
import type { MenuMatchTier } from "./menuRelevance";

/**
 * Challenge score-gap diagnostic (800 queries, scoredPool):
 * TOP1-TOP2 median 1.50 / p90 4.50
 * TOP3-TOP4 median ~0 / p75 1.14 / p90 2.54
 * TOP3-TOP10 p90 6.75
 * MENU_RANK_BOOST_EXACT = 26, MENU_RANK_GENERIC_PENALTY = 18
 *
 * Cap 3.2 reorders typical adjacent ties (median 1.5) and TOP3/TOP4 almost-ties,
 * but cannot invert a p90 leader gap (4.5) or a menu exact-vs-none gap.
 */
export const SECONDARY_COMPOSITION_CAP = 3.2;
/** Boosts only apply inside this gap of the pool leader (base score). */
export const SECONDARY_RELEVANCE_BAND = 6.5;

export type SecondaryCompositionDebug = {
  applied: boolean;
  purposeSignals: string[];
  companionSignals: string[];
  purposeScore: number;
  companionScore: number;
  totalAdjustment: number;
  reasons: string[];
};

type ScoredLike = {
  card: HomeCard;
  breakdown: {
    finalScore: number;
    menuTier?: MenuMatchTier;
    baseRankingScore?: number;
    scoreAfterComposition?: number;
    secondaryComposition?: SecondaryCompositionDebug;
  };
};

const GENERIC_PURPOSES = new Set(["dining"]);

function uniq(xs: string[]): string[] {
  return [...new Set(xs.map((x) => String(x ?? "").trim()).filter(Boolean))];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function catOf(card: HomeCard): string {
  return String(card.category ?? "").toLowerCase();
}

function blobOf(card: HomeCard): string {
  return placeTextBlob(card);
}

export function collectSecondarySignals(parsed: ScenarioObject | null | undefined): {
  purposes: string[];
  companions: string[];
} {
  if (!parsed) return { purposes: [], companions: [] };
  const uq = parsed.queryUnderstanding;
  const menus = [...(parsed.menuIntent ?? []), ...(uq?.menuIntents ?? [])].map((m) => String(m).toLowerCase());
  const purposes: string[] = [];
  for (const p of uq?.purposeIntents ?? []) {
    if (GENERIC_PURPOSES.has(p)) continue;
    if (redundantWithMenu(p, menus)) continue;
    purposes.push(p);
  }
  for (const fp of parsed.foodPreference ?? []) {
    if (fp === "brothy" || fp === "hangover" || fp === "spicy_brothy" || fp === "kid_friendly_menu") {
      if (!redundantWithMenu(fp, menus)) purposes.push(fp);
    }
  }
  if (parsed.activityLevel === "active") purposes.push("play");

  const companions: string[] = [];
  for (const c of uq?.companionIntents ?? []) companions.push(c);
  if (parsed.withKids) companions.push("child");
  if (parsed.withParents) companions.push("parents");
  if (parsed.scenario === "date") companions.push("date");
  if (parsed.scenario === "solo") companions.push("solo");
  if (parsed.scenario === "friends" || parsed.scenario === "group") companions.push("friends");
  if (parsed.scenario === "family" || parsed.scenario === "family_kids" || parsed.scenario === "parent_child_outing") {
    companions.push("family");
  }
  return { purposes: uniq(purposes), companions: uniq(companions) };
}

function redundantWithMenu(purpose: string, menus: string[]): boolean {
  const m = menus.join(" ");
  if (!m) return false;
  if (purpose === "kids_cafe" && /키즈카페/.test(m)) return true;
  if (purpose === "meat" && /고기/.test(m)) return true;
  if (purpose === "dessert" && /디저트/.test(m)) return true;
  if (purpose === "brunch" && /브런치/.test(m)) return true;
  return false;
}

function purposeFit(purpose: string, card: HomeCard): { fit: number; reason: string | null } {
  const blob = blobOf(card);
  const cat = catOf(card);
  switch (purpose) {
    case "brothy":
    case "spicy_brothy":
      if (/국물|탕|국수|면|짬뽕|라면|칼국수|찌개|국밥/.test(blob)) return { fit: 1, reason: `purpose:${purpose}:broth` };
      if (/고기|삼겹|갈비집|구이|스테이크/.test(blob) && !/국물|찌개|국밥/.test(blob)) return { fit: -0.6, reason: `purpose:${purpose}:not-broth` };
      return { fit: 0, reason: null };
    case "hangover":
      if (/해장|국밥|뼈해장|순대국/.test(blob)) return { fit: 1, reason: "purpose:hangover" };
      return { fit: 0, reason: null };
    case "dessert":
      if (cat === "cafe" || /디저트|케이크|베이커리|빵/.test(blob)) return { fit: 1, reason: "purpose:dessert" };
      if (cat === "restaurant") return { fit: -0.3, reason: "purpose:dessert:not-cafe" };
      return { fit: 0, reason: null };
    case "brunch":
      if (/브런치/.test(blob) || (cat === "cafe" && /샌드위치|샐러드|팬케이크/.test(blob))) return { fit: 1, reason: "purpose:brunch" };
      return { fit: 0, reason: null };
    case "culture":
      if (/전시|박물관|미술관|도서관|과학관/.test(blob)) return { fit: 1, reason: "purpose:culture" };
      if (cat === "restaurant") return { fit: -0.7, reason: "purpose:culture:not-culture" };
      return { fit: 0, reason: null };
    case "indoor_play":
    case "play":
      if (cat === "activity" || /놀이|체험|키즈/.test(blob)) return { fit: 1, reason: `purpose:${purpose}` };
      if (cat === "restaurant" && !/키즈|아이/.test(blob)) return { fit: -0.65, reason: `purpose:${purpose}:not-play` };
      return { fit: 0, reason: null };
    case "kids_cafe":
      if (isKidFocusedVenue(card) || /키즈카페|놀이카페/.test(blob)) return { fit: 1, reason: "purpose:kids_cafe" };
      return { fit: 0, reason: null };
    case "meat":
      if (/고기|삼겹|갈비|구이|스테이크/.test(blob)) return { fit: 1, reason: "purpose:meat" };
      return { fit: 0, reason: null };
    case "spicy":
      if (/매운|매콤|얼큰|칼칼|짬뽕|마라/.test(blob)) return { fit: 1, reason: "purpose:spicy" };
      return { fit: 0, reason: null };
    case "kid_friendly_menu":
      if (card.with_kids === true || /키즈|아이|어린이/.test(blob)) return { fit: 0.8, reason: "purpose:kid_friendly_menu" };
      return { fit: 0, reason: null };
    case "group_dinner":
      if (/회식|단체|모임|룸/.test(blob) || cat === "restaurant") return { fit: 0.5, reason: "purpose:group_dinner" };
      return { fit: 0, reason: null };
    default:
      return { fit: 0, reason: null };
  }
}

function companionFit(kind: string, card: HomeCard): { fit: number; reason: string | null } {
  const blob = blobOf(card);
  const cat = catOf(card);
  const kids = kind === "child" || kind === "family" || kind === "kids" || kind === "parents";
  if (kids) {
    if (isAlcoholNightlifeVenue(card)) return { fit: -1, reason: "companion:kids:alcohol" };
    if (isKidFocusedVenue(card)) return { fit: 1, reason: "companion:kids:kid-venue" };
    if (card.with_kids === false) return { fit: -0.55, reason: "companion:kids:not-flagged" };
    const cf = childFriendlyScore(card);
    if (cf >= 0.55 && /아이동반|가족|키즈/.test(blob)) return { fit: 0.7, reason: "companion:kids:family-tags" };
    if (cf < 0.28) return { fit: -0.4, reason: "companion:kids:low-friendly" };
    return { fit: 0, reason: null };
  }
  if (kind === "date") {
    if (isKidFocusedVenue(card)) return { fit: -0.35, reason: "companion:date:kid-venue" };
    if (cat === "salon") return { fit: -0.5, reason: "companion:date:salon" };
    if (/데이트|분위기|감성|로맨틱/.test(blob) || cat === "cafe") return { fit: 0.7, reason: "companion:date" };
    return { fit: 0, reason: null };
  }
  if (kind === "friends" || kind === "group" || kind === "company") {
    if (cat === "salon") return { fit: -0.4, reason: "companion:friends:salon" };
    if (/회식|단체|모임/.test(blob)) return { fit: 0.6, reason: "companion:friends:group" };
    if (cat === "restaurant" || cat === "cafe" || cat === "activity") return { fit: 0.2, reason: "companion:friends:ok" };
    return { fit: 0, reason: null };
  }
  if (kind === "solo") {
    if (isKidFocusedVenue(card)) return { fit: -0.5, reason: "companion:solo:kid-venue" };
    if (cat === "cafe" || cat === "restaurant") return { fit: 0.2, reason: "companion:solo" };
    return { fit: 0, reason: null };
  }
  return { fit: 0, reason: null };
}

function aggregateFits(fits: Array<{ fit: number; reason: string | null }>): { score: number; reasons: string[] } {
  const useful = fits.filter((f) => f.fit !== 0 || f.reason);
  if (!useful.length) return { score: 0, reasons: [] };
  const bestPos = Math.max(0, ...useful.map((f) => f.fit));
  const bestNeg = Math.min(0, ...useful.map((f) => f.fit));
  const score = bestPos >= Math.abs(bestNeg) ? bestPos : bestNeg;
  return { score, reasons: useful.map((f) => f.reason).filter((r): r is string => Boolean(r)) };
}

export function applySecondaryConstraintScoring<T extends ScoredLike>(
  scored: T[],
  parsed: ScenarioObject | null | undefined
): T[] {
  const { purposes, companions } = collectSecondarySignals(parsed);
  const inactive: SecondaryCompositionDebug = {
    applied: false,
    purposeSignals: purposes,
    companionSignals: companions,
    purposeScore: 0,
    companionScore: 0,
    totalAdjustment: 0,
    reasons: [],
  };
  if (!scored.length) return scored;

  for (const s of scored) {
    s.breakdown.baseRankingScore = s.breakdown.finalScore;
  }

  if (!purposes.length && !companions.length) {
    for (const s of scored) {
      s.breakdown.secondaryComposition = inactive;
      s.breakdown.scoreAfterComposition = s.breakdown.finalScore;
    }
    return scored;
  }

  const maxBase = Math.max(...scored.map((s) => s.breakdown.finalScore));
  const hasStrongMenu = scored.some((s) => s.breakdown.menuTier === "exact" || s.breakdown.menuTier === "synonym");
  const menuPrimary = Boolean(parsed?.menuIntent?.length);

  for (const s of scored) {
    const pAgg = aggregateFits(purposes.map((p) => purposeFit(p, s.card)));
    const cAgg = aggregateFits(companions.map((c) => companionFit(c, s.card)));
    const reasons = [...pAgg.reasons, ...cAgg.reasons];
    let purposePart = 0;
    let companionPart = 0;
    if (purposes.length && companions.length) {
      purposePart = pAgg.score * SECONDARY_COMPOSITION_CAP * 0.55;
      companionPart = cAgg.score * SECONDARY_COMPOSITION_CAP * 0.45;
    } else if (purposes.length) {
      purposePart = pAgg.score * SECONDARY_COMPOSITION_CAP;
    } else {
      companionPart = cAgg.score * SECONDARY_COMPOSITION_CAP;
    }
    let adj = clamp(purposePart + companionPart, -SECONDARY_COMPOSITION_CAP, SECONDARY_COMPOSITION_CAP);

    if (menuPrimary && hasStrongMenu && s.breakdown.menuTier === "none" && adj > 0) {
      adj = 0;
      reasons.push("blocked:menu-none-outside-primary");
    }
    const gap = maxBase - s.breakdown.finalScore;
    if (adj > 0 && gap > SECONDARY_RELEVANCE_BAND) {
      adj = 0;
      reasons.push("blocked:outside-relevance-band");
    }

    s.breakdown.finalScore = clamp(s.breakdown.finalScore + adj, 0, 100);
    s.breakdown.scoreAfterComposition = s.breakdown.finalScore;
    s.breakdown.secondaryComposition = {
      applied: true,
      purposeSignals: purposes,
      companionSignals: companions,
      purposeScore: pAgg.score,
      companionScore: cAgg.score,
      totalAdjustment: adj,
      reasons,
    };
  }
  return scored;
}
