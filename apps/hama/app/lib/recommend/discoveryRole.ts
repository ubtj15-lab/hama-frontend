/**
 * Discovery / generic-query role relevance — independent of Ranking v2 scoring.
 *
 * Explicit menu / strong vertical queries skip this layer entirely.
 * No per-query special cases: phrases generalize to unseen wording.
 */

import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import {
  conversationalClassToRole,
  detectConversationalDiscovery,
  focusTextForDiscovery,
  isCafeSeekingFocus,
  isGenericPlaySeekingWithoutVenue,
  isMealSeekingFocus,
  isVenueSeekingFocus,
  type ConversationalDiscoverySignal,
} from "./conversationalDiscovery";

export type DiscoveryRole =
  | "OPEN_DISCOVERY"
  | "PLAY"
  | "RELAX"
  | "DATE"
  | "FAMILY_OUTING"
  | "OUTDOOR"
  | "INDOOR"
  | "WALK"
  | "CULTURE";

export type DiscoveryAffinity = "strong" | "secondary" | "weak";

export type DiscoveryReason =
  | "NOT_DISCOVERY"
  | "DISCOVERY_ROLE_MATCH"
  | "DISCOVERY_ROLE_MISMATCH"
  | "GENERIC_DEFAULT_STORE"
  | "WEAK_QUERY_ROLE_MATCH"
  | "IN_RELEVANCE_BAND"
  | "BELOW_BAND";

export type DiscoveryClassification = {
  isDiscovery: boolean;
  role: DiscoveryRole | null;
  reasons: string[];
  conversational?: ConversationalDiscoverySignal;
  isDiscoveryBeforeConversational?: boolean;
  isDiscoveryAfterConversational?: boolean;
};

export type DiscoveryRerankItem<T> = {
  id: string;
  name: string;
  category: string | null;
  score: number;
  tags?: string[] | null;
  mood?: string[] | null;
  withKids?: boolean | null;
  description?: string | null;
  searchKeywords?: string[] | null;
  payload: T;
};

export type DiscoveryItemDebug = {
  storeId: string;
  name: string;
  role: DiscoveryRole | null;
  affinity: DiscoveryAffinity | null;
  baseScore: number;
  roleBoost: number;
  adjustedScore: number;
  reasons: DiscoveryReason[];
  finalRank: number;
};

export type DiscoveryRerankResult<T> = {
  deck: DiscoveryRerankItem<T>[];
  debug: DiscoveryItemDebug[];
  classification: DiscoveryClassification;
  bandThreshold: number;
  applied: boolean;
};

export const DISCOVERY_POOL_LIMIT = 80;
export const DISCOVERY_BAND_RATIO = 0.24;
export const DISCOVERY_BAND_MIN = 12;
export const DISCOVERY_BAND_MAX = 16;
/** Only when the current leader is role-weak (generic restaurant default). */
export const DISCOVERY_WEAK_LEADER_BAND_RATIO = 0.4;

const EXPLICIT_MENU_OR_VENUE =
  /키즈\s*카페|키즈카페|보드게임카페|방탈출\s*말고/;
const EXPLICIT_CAFE_REQUEST = /카페|커피|디저트|베이커리|빵집|브런치/;
const EXPLICIT_KIDS_CAFE = /키즈\s*카페|키즈카페|놀이카페|키즈룸/;

const OPEN_PLAY = /심심|뭐하지|뭐하고|갈\s*데|어디\s*갈|어디\s*가지|시간\s*남|놀지|놀거리/;
const OUTDOOR_PH = /야외|공원|산책|나들이|날씨\s*좋|바람\s*쐬/;
const WALK_PH = /산책|걷|둘레|호수/;
const RELAX_PH = /조용|책\s*읽|힐링|시간\s*때울|시간\s*보낼|쉬고/;
const DATE_PH = /데이트|여자친구|남자친구|연인|커플|둘이/;
const FAMILY_PH = /아이랑|애들이|애들|아이\s|유아|가족|초등|육아/;
const INDOOR_PH = /실내|비\s*오|비오|장마/;
const CULTURE_PH = /전시|도서관|관람|박물관|미술관/;
const PLAY_PH = /놀\s*|체험|방탈출|보드게임|액티비티/;
/** Indoor + do/play seeking — not rain-only shelter, not relax/cafe/meal. */
const INDOOR_DO_PH = /뭐\s*하지|뭐하지|어디\s*가지|어디\s*갈까|놀까|놀\s*만|놀거리|할\s*곳/;

const GENERIC_RESTAURANT_NAME =
  /국밥|순대|순댓|짬뽕|만두|찌개|백반|김밥|라면|분식|해장|설렁탕|감자탕|추어탕|칼국수(?!이)/;
const DATE_RESTAURANT =
  /스테이크|파스타|와인|오마카세|이탈|분위기|기념|데이트|빕스|레스토랑|브런치|스시|초밥|코스요리/;
const PARK_NAME = /공원|호수공원|근린공원|숲|산책로|물놀이장/;
const PLAY_ACTIVITY = /키즈|방탈출|보드게임|VR|볼링|만화|코인|체험|플레이|키즈카페|키즈룸/;
/**
 * Catalog keywords that already mark an indoor play venue.
 * Not inferred from category=activity alone. Parks stay outdoor.
 */
const INDOOR_PLAY_VENUE =
  /실내|인도어|indoor|보드게임|보드카페|방탈출|볼링|vr|키즈카페|키즈룸|실내놀이|만화|코인|오락실|아케이드|스크린골프|스크린야구/;
/** Adult-coded holdem/poker — not a global pub blacklist. */
const HOLDEM_POKER_CODED = /홀덤|포커펍|포커/;

function compact(s: string): string {
  return String(s ?? "").toLowerCase().replace(/\s+/g, "");
}

function hayOf(item: {
  name: string;
  category: string | null;
  tags?: string[] | null;
  mood?: string[] | null;
  description?: string | null;
  searchKeywords?: string[] | null;
}): string {
  return compact(
    [
      item.name,
      item.category ?? "",
      ...(item.tags ?? []),
      ...(item.mood ?? []),
      item.description ?? "",
      ...(item.searchKeywords ?? []),
    ].join(" ")
  );
}

export function discoveryBandThreshold(bestScore: number, weakLeader: boolean): number {
  if (!Number.isFinite(bestScore) || bestScore <= 0) return DISCOVERY_BAND_MIN;
  const tight = Math.max(DISCOVERY_BAND_MIN, Math.min(DISCOVERY_BAND_MAX, bestScore * DISCOVERY_BAND_RATIO));
  if (!weakLeader) return tight;
  const relaxed = Math.min(bestScore * DISCOVERY_WEAK_LEADER_BAND_RATIO, 24);
  return Math.max(tight, relaxed);
}

export function isKidsIndoorPlayIntent(raw: string, parsed: ScenarioObject): boolean {
  const purposes = parsed.queryUnderstanding?.purposeIntents ?? [];
  const isFamily = FAMILY_PH.test(raw) || Boolean(parsed.withKids);
  const isIndoor =
    INDOOR_PH.test(raw) || parsed.indoorPreferred === true || purposes.includes("indoor_play");
  const isPlay =
    PLAY_PH.test(raw) ||
    purposes.includes("indoor_play") ||
    purposes.includes("play") ||
    purposes.includes("kids_cafe");
  return isFamily && isIndoor && isPlay;
}

/** PLAY deck that must satisfy play suitability AND indoor evidence. */
export function isIndoorPlayRerankQuery(query: string, parsed: ScenarioObject): boolean {
  return isKidsIndoorPlayIntent(query, parsed) || isIndoorPlaySeekingQuery(query, parsed);
}

/**
 * Generic indoor PLAY (Home "실내에서 놀까?" family).
 * Requires explicit 실내 — rain-only "비 오는데 뭐하지" stays INDOOR.
 * Does not imply kids and does not force every 실내 query into PLAY.
 */
export function isIndoorPlaySeekingQuery(query: string, parsed?: ScenarioObject | null): boolean {
  const raw = String(query ?? parsed?.rawQuery ?? "").trim();
  if (!raw) return false;
  if (!/실내/.test(raw) && parsed?.indoorPreferred !== true) return false;
  if (!/실내/.test(raw)) return false;
  const focus = parsed ? focusTextForDiscovery(parsed, raw) : raw;
  if (isMealSeekingFocus(focus) || isCafeSeekingFocus(focus)) return false;
  if (/식당|레스토랑|맛집|밥집/.test(focus) && !PLAY_PH.test(raw)) return false;
  const relaxOnly = RELAX_PH.test(raw) && !PLAY_PH.test(raw) && !INDOOR_DO_PH.test(raw);
  if (relaxOnly) return false;
  const purposes = parsed?.queryUnderstanding?.purposeIntents ?? [];
  return (
    PLAY_PH.test(raw) ||
    INDOOR_DO_PH.test(raw) ||
    purposes.includes("play") ||
    purposes.includes("indoor_play")
  );
}

export function classifyDiscoveryQuery(query: string, parsed: ScenarioObject): DiscoveryClassification {
  const raw = String(query ?? "").trim();
  const reasons: string[] = [];
  const menus = parsed.menuIntent ?? parsed.queryUnderstanding?.menuIntents ?? [];
  const uq = parsed.queryUnderstanding;
  const focus = focusTextForDiscovery(parsed, raw);
  const conversational = parsed.conversationalDiscovery ?? detectConversationalDiscovery(raw, parsed);

  const blockedMenu = menus.length > 0 || Boolean(parsed.catalogMenu?.catalogMenuPrimary);
  if (blockedMenu) {
    return {
      isDiscovery: false,
      role: null,
      reasons: ["explicit_menu"],
      conversational,
      isDiscoveryBeforeConversational: false,
      isDiscoveryAfterConversational: false,
    };
  }
  if (parsed.intentType === "search_strict" && parsed.intentCategory) {
    // P1: ACTIVITY-strict "놀고" must not skip PLAY rerank for explicit kids+indoor+play.
    const kidsIndoorPlayOverlay =
      parsed.intentCategory === "ACTIVITY" && isKidsIndoorPlayIntent(raw, parsed);
    const indoorPlayOverlay =
      parsed.intentCategory === "ACTIVITY" && isIndoorPlaySeekingQuery(raw, parsed);
    const activityOverlay =
      parsed.intentCategory === "ACTIVITY" &&
      conversational.detected &&
      isGenericPlaySeekingWithoutVenue(focus) &&
      !isVenueSeekingFocus(focus);
    if (!activityOverlay && !kidsIndoorPlayOverlay && !indoorPlayOverlay) {
      return {
        isDiscovery: false,
        role: null,
        reasons: ["search_strict"],
        conversational,
        isDiscoveryBeforeConversational: false,
        isDiscoveryAfterConversational: false,
      };
    }
  }
  if (uq?.strongVertical) {
    return {
      isDiscovery: false,
      role: null,
      reasons: ["strong_vertical"],
      conversational,
      isDiscoveryBeforeConversational: false,
      isDiscoveryAfterConversational: false,
    };
  }

  const excluded = uq?.negation?.excludedCategories ?? [];
  if ((EXPLICIT_KIDS_CAFE.test(focus) || EXPLICIT_MENU_OR_VENUE.test(focus)) && !conversational.detected) {
    return {
      isDiscovery: false,
      role: null,
      reasons: ["explicit_venue"],
      conversational,
      isDiscoveryBeforeConversational: false,
      isDiscoveryAfterConversational: false,
    };
  }
  if (isMealSeekingFocus(focus) && !excluded.includes("restaurant")) {
    return {
      isDiscovery: false,
      role: null,
      reasons: ["explicit_meal"],
      conversational,
      isDiscoveryBeforeConversational: false,
      isDiscoveryAfterConversational: false,
    };
  }

  const isOpen = OPEN_PLAY.test(focus) || OPEN_PLAY.test(raw);
  const isOutdoor = OUTDOOR_PH.test(focus) || OUTDOOR_PH.test(raw);
  const isWalk = WALK_PH.test(focus) || WALK_PH.test(raw);
  const isRelax = RELAX_PH.test(focus) || RELAX_PH.test(raw);
  const isDate = DATE_PH.test(raw) || parsed.scenario === "date";
  const isFamily = FAMILY_PH.test(raw) || Boolean(parsed.withKids);
  const isIndoor = INDOOR_PH.test(raw);
  const isCulture = CULTURE_PH.test(raw);
  const isPlay = PLAY_PH.test(raw);

  if (/빵/.test(focus) && !isOpen && !isOutdoor && !isDate && !conversational.detected) {
    return {
      isDiscovery: false,
      role: null,
      reasons: ["explicit_bakery"],
      conversational,
      isDiscoveryBeforeConversational: false,
      isDiscoveryAfterConversational: false,
    };
  }
  if (isCafeSeekingFocus(focus) && !excluded.includes("cafe") && !isOutdoor && !isOpen && !(isDate && !/카페/.test(focus))) {
    if (!conversational.detected) {
      return {
        isDiscovery: false,
        role: null,
        reasons: ["explicit_cafe"],
        conversational,
        isDiscoveryBeforeConversational: false,
        isDiscoveryAfterConversational: false,
      };
    }
  }

  const isKidsIndoorPlay = isKidsIndoorPlayIntent(raw, parsed);

  const isFamilyOuting =
    isFamily && (isOpen || isOutdoor || isWalk || conversational.detected || /갈\s*곳|나들이|놀\s*|뭐하|체험/.test(raw));

  const looksDiscoveryV1 =
    isOpen ||
    isOutdoor ||
    isWalk ||
    isRelax ||
    (isDate && !EXPLICIT_CAFE_REQUEST.test(focus)) ||
    isFamilyOuting ||
    isCulture ||
    isIndoorPlaySeekingQuery(raw, parsed) ||
    (isPlay && !EXPLICIT_MENU_OR_VENUE.test(focus) && !EXPLICIT_CAFE_REQUEST.test(focus));

  const looksDiscovery = looksDiscoveryV1 || conversational.detected;

  if (!looksDiscovery) {
    return {
      isDiscovery: false,
      role: null,
      reasons: ["not_discovery_shape"],
      conversational,
      isDiscoveryBeforeConversational: false,
      isDiscoveryAfterConversational: false,
    };
  }

  let role: DiscoveryRole = "OPEN_DISCOVERY";
  if (isOutdoor && (isWalk || /야외|공원|날씨/.test(raw))) {
    role = "OUTDOOR";
    reasons.push("outdoor_phrase");
  } else if (isWalk && !isFamily) {
    role = "WALK";
    reasons.push("walk_phrase");
  } else if (isRelax && !isDate) {
    role = "RELAX";
    reasons.push("relax_phrase");
  } else if (isDate) {
    role = "DATE";
    reasons.push("date_phrase");
  } else if (isKidsIndoorPlay) {
    role = "PLAY";
    reasons.push("kids_indoor_play");
  } else if (isIndoorPlaySeekingQuery(raw, parsed)) {
    role = "PLAY";
    reasons.push("indoor_play");
  } else if (isIndoor && (isFamilyOuting || isOpen || conversational.detected)) {
    role = "INDOOR";
    reasons.push("indoor_phrase");
  } else if (isFamilyOuting) {
    role = "FAMILY_OUTING";
    reasons.push("family_phrase");
  } else if (isIndoor && !isOpen) {
    role = "INDOOR";
    reasons.push("indoor_phrase");
  } else if (isCulture) {
    role = "CULTURE";
    reasons.push("culture_phrase");
  } else if (isPlay && !isOpen && !conversational.detected) {
    role = "PLAY";
    reasons.push("play_phrase");
  } else if (isOpen) {
    role = /놀/.test(raw) ? "PLAY" : "OPEN_DISCOVERY";
    reasons.push("open_play_phrase");
  } else if (conversational.detected) {
    role = conversationalClassToRole(conversational.semanticClass, parsed);
    reasons.push("conversational_discovery", conversational.semanticClass ?? "open");
  }

  if (isOutdoor && isFamily && role === "FAMILY_OUTING") {
    role = "OUTDOOR";
    reasons.push("family_outdoor_as_outdoor");
  }
  if (isWalk && isOutdoor) role = "OUTDOOR";

  return {
    isDiscovery: true,
    role,
    reasons,
    conversational,
    isDiscoveryBeforeConversational: looksDiscoveryV1,
    isDiscoveryAfterConversational: true,
  };
}

export function isParkOrWalkPlace(item: DiscoveryRerankItem<unknown>): boolean {
  const cat = String(item.category ?? "").toLowerCase();
  if (cat === "restaurant" || cat === "cafe" || cat === "salon") return false;
  return PARK_NAME.test(item.name) || PARK_NAME.test(hayOf(item));
}

/**
 * Explicit indoor PLAY: play/activity suitability AND indoor suitability.
 * Activity category alone is not enough. Outdoor parks never qualify.
 */
export function hasCredibleIndoorPlayEvidence(item: DiscoveryRerankItem<unknown>): boolean {
  const cat = String(item.category ?? "").toLowerCase();
  if (cat === "restaurant" || cat === "cafe" || cat === "salon") return false;
  if (isParkOrWalkPlace(item)) return false;
  const hay = hayOf(item);
  if (/야외전용|야외에서만|오픈에어만/.test(hay)) return false;
  const playSuitable = cat === "activity" && (PLAY_ACTIVITY.test(hay) || INDOOR_PLAY_VENUE.test(hay));
  const indoorSuitable = INDOOR_PLAY_VENUE.test(hay);
  return playSuitable && indoorSuitable;
}

export function isHoldemPokerCodedVenue(item: DiscoveryRerankItem<unknown>): boolean {
  return HOLDEM_POKER_CODED.test(item.name) || HOLDEM_POKER_CODED.test(hayOf(item));
}

export function isExplicitHoldemPokerQuery(query: string): boolean {
  return HOLDEM_POKER_CODED.test(String(query ?? ""));
}

/** Generic indoor PLAY hides holdem/poker when the user did not ask for it. */
export function shouldHideHoldemPokerForGenericIndoorPlay(query: string, parsed: ScenarioObject): boolean {
  return isIndoorPlaySeekingQuery(query, parsed) && !isExplicitHoldemPokerQuery(query);
}

export function isGenericRestaurant(item: DiscoveryRerankItem<unknown>): boolean {
  const cat = String(item.category ?? "").toLowerCase();
  if (cat !== "restaurant") return false;
  if (DATE_RESTAURANT.test(item.name) || DATE_RESTAURANT.test(hayOf(item))) return false;
  return GENERIC_RESTAURANT_NAME.test(item.name) || GENERIC_RESTAURANT_NAME.test(hayOf(item));
}

export function candidateDiscoveryAffinity(
  item: DiscoveryRerankItem<unknown>,
  role: DiscoveryRole
): DiscoveryAffinity {
  const cat = String(item.category ?? "").toLowerCase();
  const hay = hayOf(item);
  const park = isParkOrWalkPlace(item);
  const playAct = cat === "activity" && PLAY_ACTIVITY.test(hay);
  const cafe = cat === "cafe";
  const library = cat === "library" || /도서관|서점|북카페/.test(hay);
  const genericR = isGenericRestaurant(item);
  const dateR = cat === "restaurant" && DATE_RESTAURANT.test(hay);
  const familyR = cat === "restaurant" && (item.withKids === true || /아이동반|가족/.test(hay));
  const activity = cat === "activity";

  switch (role) {
    case "OUTDOOR":
    case "WALK":
      if (park) return "strong";
      if (activity && /물놀이|야외|산책|호수|숲/.test(hay) && !playAct) return "strong";
      if (cafe) return "secondary";
      if (activity && !playAct) return "secondary";
      return "weak";
    case "PLAY":
    case "OPEN_DISCOVERY":
      if (playAct || (activity && !park)) return "strong";
      if (park) return "secondary";
      if (cafe) return "secondary";
      if (library) return "secondary";
      return "weak";
    case "RELAX":
      if (cafe || library) return "strong";
      if (activity && !PLAY_ACTIVITY.test(hay) && !park) return "secondary";
      return "weak";
    case "DATE":
      if (cafe) return "strong";
      if (dateR) return "strong";
      if (park || library) return "strong";
      if (activity) return "secondary";
      if (genericR) return "weak";
      if (cat === "restaurant") return "secondary";
      return "weak";
    case "FAMILY_OUTING":
      if (activity || park) return "strong";
      if (cafe) return "secondary";
      if (familyR) return "secondary";
      if (genericR) return "weak";
      return "weak";
    case "INDOOR":
      if (park) return "weak";
      if (cafe || playAct || library) return "strong";
      if (activity) return "strong";
      if (cat === "restaurant") return "secondary";
      return "weak";
    case "CULTURE":
      if (library || /전시|박물관|미술관/.test(hay)) return "strong";
      if (cafe) return "secondary";
      return "weak";
    default:
      if (activity) return "strong";
      if (cafe) return "secondary";
      return "weak";
  }
}

export function discoveryRoleBoost(affinity: DiscoveryAffinity, genericRestaurant: boolean): number {
  let boost = affinity === "strong" ? 16 : affinity === "secondary" ? 4 : -12;
  if (genericRestaurant && affinity === "weak") boost -= 4;
  return boost;
}

function cardFromHome(card: HomeCard): Omit<DiscoveryRerankItem<HomeCard>, "score" | "payload"> {
  return {
    id: card.id,
    name: card.name,
    category: card.category,
    tags: card.tags,
    mood: card.mood,
    withKids: card.with_kids ?? null,
    description: card.description ?? null,
    searchKeywords: card.search_keywords ?? null,
  };
}

export function toDiscoveryItem<T extends HomeCard>(card: T, score: number): DiscoveryRerankItem<T> {
  return { ...cardFromHome(card), score, payload: card };
}

/**
 * Reorder inside a relevance band. Weak generic leaders get a slightly wider band
 * so nearby role-strong places can compete; far-below-band items never overtake.
 */
export function applyDiscoveryRerank<T>(
  items: DiscoveryRerankItem<T>[],
  query: string,
  parsed: ScenarioObject,
  options: { deckSize?: number; poolLimit?: number; naturalDeckIds?: string[] } = {}
): DiscoveryRerankResult<T> {
  const classification = classifyDiscoveryQuery(query, parsed);
  const deckSize = options.deckSize ?? 3;
  const ranked = [...items].sort((a, b) => (b.score !== a.score ? b.score - a.score : a.id.localeCompare(b.id)));
  const naturalIds = (options.naturalDeckIds ?? []).filter((id) => ranked.some((r) => r.id === id));
  const passthrough = (): DiscoveryRerankResult<T> => {
    const deck = (naturalIds.length ? naturalIds.map((id) => ranked.find((r) => r.id === id)!).filter(Boolean) : ranked).slice(
      0,
      deckSize
    );
    return {
      deck,
      debug: deck.map((d, i) => ({
        storeId: d.id,
        name: d.name,
        role: classification.role,
        affinity: null,
        baseScore: d.score,
        roleBoost: 0,
        adjustedScore: d.score,
        reasons: ["NOT_DISCOVERY"],
        finalRank: i + 1,
      })),
      classification,
      bandThreshold: 0,
      applied: false,
    };
  };

  if (!classification.isDiscovery || !classification.role || !ranked.length) return passthrough();

  const role = classification.role;
  const pool = ranked;
  const best = pool[0]!.score;
  const leaderAff = candidateDiscoveryAffinity(pool[0]!, role);
  const weakLeader = leaderAff === "weak";
  const band = discoveryBandThreshold(best, weakLeader);
  const cutoff = best - band;

  const annotate = (item: DiscoveryRerankItem<T>) => {
    const affinity = candidateDiscoveryAffinity(item, role);
    const generic = isGenericRestaurant(item);
    const boost = discoveryRoleBoost(affinity, generic);
    const reasons: DiscoveryReason[] = [];
    if (affinity === "strong") reasons.push("DISCOVERY_ROLE_MATCH");
    if (affinity === "weak") reasons.push("DISCOVERY_ROLE_MISMATCH");
    if (generic) reasons.push("GENERIC_DEFAULT_STORE");
    if (affinity === "weak" && !generic) reasons.push("WEAK_QUERY_ROLE_MATCH");
    if (item.score >= cutoff) reasons.push("IN_RELEVANCE_BAND");
    else reasons.push("BELOW_BAND");
    return { item, affinity, boost, adjusted: item.score + boost, generic, reasons };
  };

  const annotated = pool.map(annotate);
  const preferred = annotated.filter((a) => a.affinity !== "weak" && a.item.score >= best * 0.48);
  const preferStrongFirst =
    role === "OUTDOOR" || role === "WALK" || role === "PLAY" || role === "OPEN_DISCOVERY" || role === "FAMILY_OUTING";
  const affRank = (a: DiscoveryAffinity) => (a === "strong" ? 2 : a === "secondary" ? 1 : 0);
  preferred.sort((a, b) => {
    if (preferStrongFirst && affRank(b.affinity) !== affRank(a.affinity)) return affRank(b.affinity) - affRank(a.affinity);
    if (b.adjusted !== a.adjusted) return b.adjusted - a.adjusted;
    if (b.item.score !== a.item.score) return b.item.score - a.item.score;
    return a.item.id.localeCompare(b.item.id);
  });
  const weakOk = annotated
    .filter((a) => a.affinity === "weak" && a.item.score >= cutoff)
    .sort((a, b) => b.adjusted - a.adjusted || a.item.id.localeCompare(b.item.id));

  const used = new Set<string>();
  const picked: typeof annotated = [];
  const take = (row: (typeof annotated)[number]) => {
    if (picked.length >= deckSize || used.has(row.item.id)) return;
    if (
      role === "DATE" &&
      picked.length >= 2 &&
      picked.every((p) => String(p.item.category ?? "").toLowerCase() === String(row.item.category ?? "").toLowerCase()) &&
      annotated.some((a) => !used.has(a.item.id) && a.affinity !== "weak" && String(a.item.category ?? "") !== String(row.item.category ?? ""))
    ) {
      return;
    }
    used.add(row.item.id);
    picked.push(row);
  };

  const indoorPlayDeck = role === "PLAY" && isIndoorPlayRerankQuery(query, parsed);
  const strongIndoorPlay = annotated
    .filter((a) => hasCredibleIndoorPlayEvidence(a.item))
    .sort((a, b) => {
      if (b.adjusted !== a.adjusted) return b.adjusted - a.adjusted;
      if (b.item.score !== a.item.score) return b.item.score - a.item.score;
      return a.item.id.localeCompare(b.item.id);
    });
  if (indoorPlayDeck) {
    const hideHoldem = shouldHideHoldemPokerForGenericIndoorPlay(query, parsed);
    const indoorRows = hideHoldem
      ? strongIndoorPlay.filter((a) => !isHoldemPokerCodedVenue(a.item))
      : strongIndoorPlay;
    for (const row of indoorRows) take(row);
  } else {
    for (const row of preferred) take(row);
    if (picked.length < deckSize) {
      for (const row of weakOk) {
        if (picked.some((p) => p.affinity === "weak") && preferred.length) break;
        take(row);
      }
    }
    if (picked.length < deckSize) {
      for (const id of naturalIds) {
        const it = ranked.find((r) => r.id === id);
        if (!it) continue;
        const row = annotate(it);
        if (row.affinity === "weak" && picked.length > 0) continue;
        take(row);
      }
    }
  }

  const deck = picked.map((p) => p.item).slice(0, deckSize);
  const debug: DiscoveryItemDebug[] = picked.slice(0, deckSize).map((p, i) => ({
    storeId: p.item.id,
    name: p.item.name,
    role,
    affinity: p.affinity,
    baseScore: p.item.score,
    roleBoost: p.boost,
    adjustedScore: p.adjusted,
    reasons: p.reasons,
    finalRank: i + 1,
  }));

  return { deck, debug, classification, bandThreshold: band, applied: true };
}
