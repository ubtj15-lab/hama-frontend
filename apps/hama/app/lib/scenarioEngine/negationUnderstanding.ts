import type { HomeCard } from "@/lib/storeTypes";
import type { IntentCategory, ParsedRecommendationQuery, QueryNegation, QueryUnderstandingCategory, ScenarioObject } from "./types";
import { stripExcludedVenueSurfaces } from "./venuePolarity";

export type NegationType =
  | "CATEGORY_EXCLUSION"
  | "MENU_EXCLUSION"
  | "CONTEXT_EXCLUSION"
  | "ALREADY_SATISFIED"
  | "PREFERENCE_NEGATION"
  | "CONTRASTIVE"
  | "VENUE_EXCLUSION";

export type NegationPatternId =
  | "X 말고"
  | "X 말고는"
  | "X 말고 다른"
  | "X 빼고"
  | "X 제외하고"
  | "X는 싫어"
  | "X 싫고"
  | "X는 별로"
  | "X는 지겨워"
  | "already_ate"
  | "already_drank";

export type { QueryNegation };

type ConceptKind = "category" | "menu" | "context" | "attribute" | "venue" | "intent";

type Concept = {
  phrases: readonly string[];
  kind: ConceptKind;
  value: string;
  category?: QueryUnderstandingCategory;
  hard: boolean;
};

const CONCEPTS: readonly Concept[] = [
  { phrases: ["키즈카페", "키즈 카페", "놀이카페"], kind: "venue", value: "kids_cafe", hard: true },
  { phrases: ["고깃집", "고기집"], kind: "menu", value: "고기", category: "restaurant", hard: true },
  { phrases: ["삼겹살", "목살", "소고기", "돼지고기", "숯불구이"], kind: "menu", value: "고기", hard: true },
  { phrases: ["카페", "커피숍", "커피집"], kind: "category", value: "cafe", category: "cafe", hard: true },
  { phrases: ["식당", "밥집", "레스토랑"], kind: "category", value: "restaurant", category: "restaurant", hard: true },
  { phrases: ["야외", "바깥"], kind: "context", value: "outdoor", hard: true },
  { phrases: ["실내"], kind: "context", value: "indoor", hard: true },
  { phrases: ["공원"], kind: "context", value: "park", hard: true },
  { phrases: ["술집", "포차", "이자카야"], kind: "venue", value: "alcohol", hard: true },
  { phrases: ["고기"], kind: "menu", value: "고기", hard: true },
  { phrases: ["국밥"], kind: "menu", value: "국밥", hard: true },
  { phrases: ["매운"], kind: "attribute", value: "spicy", hard: false },
  { phrases: ["시끄러운"], kind: "attribute", value: "loud", hard: false },
  { phrases: ["멀리"], kind: "attribute", value: "far", hard: false },
  { phrases: ["밥"], kind: "intent", value: "MEAL", hard: false },
];

const MARKERS: Array<{ re: RegExp; pattern: NegationPatternId }> = [
  { re: /말고는/g, pattern: "X 말고는" },
  { re: /말고\s*다른/g, pattern: "X 말고 다른" },
  { re: /말고\s*뭐/g, pattern: "X 말고" },
  { re: /제외하고/g, pattern: "X 제외하고" },
  { re: /제외해/g, pattern: "X 제외하고" },
  { re: /제외(?!하)/g, pattern: "X 제외하고" },
  { re: /빼고/g, pattern: "X 빼고" },
  { re: /말고/g, pattern: "X 말고" },
  { re: /[은는가]\s*싫어/g, pattern: "X는 싫어" },
  { re: /싫고/g, pattern: "X 싫고" },
  { re: /[은는]\s*별로/g, pattern: "X는 별로" },
  { re: /[은는]\s*지겨/g, pattern: "X는 지겨워" },
  { re: /[은는]\s*싫은데/g, pattern: "X는 싫어" },
];

const ALREADY_ATE =
  /(?:밥은?\s*)?이미\s*먹었|(?:밥|식사)(?:은|를|을)?\s*(?:이미\s*)?(?:했|먹었)|밥은\s*됐|밥\s*먹었|밥\s*먹고\s*(?:나왔|나와|서)|배는\s*불|저녁\s*끝났|식사는\s*했/;
const ALREADY_COFFEE = /커피(?:는|를|을)?\s*(?:이미\s*)?마셨/;

const MEALISH_REMAINDER = /밥|먹|국물|국밥|칼국수|찌개|점심|저녁|맛집|식당|밥집|커리|파스타|면/;

function compact(s: string): string {
  return String(s ?? "").toLowerCase().replace(/\s+/g, "");
}

function findConceptAtEnd(before: string): { concept: Concept; phrase: string } | null {
  const packed = compact(before);
  if (!packed) return null;
  const ranked = [...CONCEPTS].sort(
    (a, b) => Math.max(...b.phrases.map((p) => compact(p).length)) - Math.max(...a.phrases.map((p) => compact(p).length))
  );
  for (const concept of ranked) {
    for (const phrase of concept.phrases) {
      const p = compact(phrase);
      if (p.length < 1) continue;
      if (packed.endsWith(p)) return { concept, phrase };
      const idx = packed.lastIndexOf(p);
      if (idx >= 0 && packed.length - (idx + p.length) <= 1) return { concept, phrase };
    }
  }
  return null;
}

function stripSpan(query: string, start: number, end: number): string {
  return `${query.slice(0, start)} ${query.slice(end)}`.replace(/\s+/g, " ").trim();
}

function remainderPurposes(remainder: string): string[] {
  const out: string[] = [];
  if (/아이|애들|유아|초등|키즈|가족/.test(remainder)) out.push("FAMILY");
  if (/놀|체험|액티비티|보드|갈\s*(?:데|곳)/.test(remainder)) out.push("PLAY");
  if (/데이트|연인|둘이/.test(remainder)) out.push("DATE");
  if (/실내/.test(remainder)) out.push("INDOOR");
  if (/야외|산책|공원/.test(remainder)) out.push("OUTDOOR");
  if (/국물|국밥|칼국수|찌개|해장/.test(remainder)) out.push("SOUP");
  if (/카페|커피|디저트/.test(remainder)) out.push("CAFE");
  if (/조용|책|힐링/.test(remainder)) out.push("RELAX");
  return out;
}

export function emptyNegation(rawQuery: string): QueryNegation {
  return {
    isNegationQuery: false,
    patterns: [],
    types: [],
    excludedCategories: [],
    excludedMenus: [],
    excludedContexts: [],
    excludedAttributes: [],
    suppressedIntents: [],
    excludedVenues: [],
    positiveRemainder: String(rawQuery ?? "").trim(),
    positivePurpose: [],
    hardExclusions: [],
    softSuppressions: [],
    fallbackReason: null,
  };
}

export function parseQueryNegation(rawQuery: string): QueryNegation {
  const raw = String(rawQuery ?? "").trim();
  const out = emptyNegation(raw);
  if (!raw) return out;

  const types = new Set<NegationType>();
  let working = raw;
  const removed: Array<{ start: number; end: number }> = [];

  const ate = ALREADY_ATE.exec(raw);
  if (ate) {
    out.patterns.push("already_ate");
    out.suppressedIntents.push("MEAL");
    out.softSuppressions.push("MEAL");
    types.add("ALREADY_SATISFIED");
    removed.push({ start: ate.index, end: ate.index + ate[0].length });
  }
  const drank = ALREADY_COFFEE.exec(raw);
  if (drank) {
    out.patterns.push("already_drank");
    out.suppressedIntents.push("CAFE");
    out.softSuppressions.push("CAFE");
    types.add("ALREADY_SATISFIED");
    removed.push({ start: drank.index, end: drank.index + drank[0].length });
  }

  for (const marker of MARKERS) {
    marker.re.lastIndex = 0;
    const re = new RegExp(marker.re.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) != null) {
      const markerStart = m.index;
      const before = raw.slice(0, markerStart);
      const hit = findConceptAtEnd(before);
      if (!hit) continue;
      out.patterns.push(marker.pattern);
      const phrasePacked = compact(hit.phrase);
      const beforePacked = compact(before);
      const phraseStartPacked = beforePacked.lastIndexOf(phrasePacked);
      void phraseStartPacked;
      const phraseIdx = before.toLowerCase().lastIndexOf(hit.phrase);
      const spanStart = phraseIdx >= 0 ? phraseIdx : Math.max(0, markerStart - hit.phrase.length);
      removed.push({ start: spanStart, end: markerStart + m[0].length });

      const c = hit.concept;
      if (c.kind === "category" && c.category) {
        if (c.category === "restaurant" && MEALISH_REMAINDER.test(raw.slice(markerStart + m[0].length))) {
          // "음식점 말고 커리집" style — remainder still food; skip hard restaurant drop
        } else {
          out.excludedCategories.push(c.category);
          if (c.hard) out.hardExclusions.push(`category:${c.category}`);
          types.add("CATEGORY_EXCLUSION");
        }
      } else if (c.kind === "menu") {
        out.excludedMenus.push(c.value);
        if (c.hard) out.hardExclusions.push(`menu:${c.value}`);
        types.add("MENU_EXCLUSION");
      } else if (c.kind === "context") {
        out.excludedContexts.push(c.value);
        if (c.hard) out.hardExclusions.push(`context:${c.value}`);
        types.add("CONTEXT_EXCLUSION");
      } else if (c.kind === "attribute") {
        out.excludedAttributes.push(c.value);
        out.softSuppressions.push(c.value);
        types.add("PREFERENCE_NEGATION");
      } else if (c.kind === "venue") {
        out.excludedVenues.push(c.value);
        if (c.hard) out.hardExclusions.push(`venue:${c.value}`);
        types.add("VENUE_EXCLUSION");
      } else if (c.kind === "intent") {
        out.suppressedIntents.push(c.value);
        const rest = raw.slice(markerStart + m[0].length);
        if (c.value === "MEAL" && !MEALISH_REMAINDER.test(rest)) {
          out.excludedCategories.push("restaurant");
          out.hardExclusions.push("category:restaurant");
          types.add("CATEGORY_EXCLUSION");
        } else {
          out.softSuppressions.push("MEAL");
        }
        types.add("ALREADY_SATISFIED");
      }
    }
  }

  if (removed.length) {
    let q = raw;
    for (const span of [...removed].sort((a, b) => b.start - a.start)) {
      q = stripSpan(q, span.start, span.end);
    }
    working = q;
  }

  out.excludedCategories = [...new Set(out.excludedCategories)];
  out.excludedMenus = [...new Set(out.excludedMenus)];
  out.excludedContexts = [...new Set(out.excludedContexts)];
  out.excludedAttributes = [...new Set(out.excludedAttributes)];
  out.suppressedIntents = [...new Set(out.suppressedIntents)];
  out.excludedVenues = [...new Set(out.excludedVenues)];
  out.patterns = [...new Set(out.patterns)];
  out.hardExclusions = [...new Set(out.hardExclusions)];
  out.softSuppressions = [...new Set(out.softSuppressions)];

  const hasNeg =
    out.excludedCategories.length +
      out.excludedMenus.length +
      out.excludedContexts.length +
      out.excludedVenues.length +
      out.suppressedIntents.length +
      out.excludedAttributes.length >
    0;
  out.isNegationQuery = hasNeg;
  out.positiveRemainder = (working || raw).replace(/\s+/g, " ").trim();
  out.positivePurpose = hasNeg ? remainderPurposes(out.positiveRemainder) : [];

  if (
    (out.excludedCategories.length > 0 || out.excludedMenus.length > 0 || out.excludedVenues.length > 0) &&
    (out.positivePurpose.length > 0 || out.excludedMenus.length > 0)
  ) {
    types.add("CONTRASTIVE");
  }
  out.types = [...types];
  return out;
}

function cardBlob(card: HomeCard): string {
  return [
    card.name,
    card.category,
    card.description,
    ...(card.tags ?? []),
    ...(card.mood ?? []),
    ...(card.menu_keywords ?? []),
    ...(card.search_keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function cardCategory(card: HomeCard): string {
  const c = String(card.category ?? "").toLowerCase();
  if (c.includes("cafe") || c === "ce7") return "cafe";
  if (c.includes("restaurant") || c === "fd6" || c.includes("food")) return "restaurant";
  if (c.includes("activity") || c === "at4" || c === "library" || c === "museum") return "activity";
  if (c.includes("salon") || c === "bk9") return "salon";
  return c;
}

export function cardViolatesHardNegation(card: HomeCard, negation: QueryNegation | undefined | null): boolean {
  if (!negation?.isNegationQuery) return false;
  const cat = cardCategory(card);
  const blob = cardBlob(card);
  if (negation.excludedCategories.includes("cafe") && cat === "cafe") return true;
  if (negation.excludedCategories.includes("restaurant") && cat === "restaurant") return true;
  if (negation.excludedCategories.includes("activity") && cat === "activity") return true;
  if (negation.excludedVenues.includes("kids_cafe") && /키즈\s*카페|키즈카페|놀이카페|키즈룸|키즈아트/.test(blob)) {
    return true;
  }
  if (negation.excludedVenues.includes("alcohol") && /술집|포차|이자카야|호프/.test(blob)) return true;
  if (negation.excludedContexts.includes("outdoor") || negation.excludedContexts.includes("park")) {
    if (/공원|야외|호수공원|근린공원/.test(blob) && !/실내/.test(blob)) return true;
  }
  if (negation.excludedContexts.includes("indoor") && /실내/.test(blob) && !/공원|야외/.test(blob)) {
    return true;
  }
  if (negation.excludedMenus.includes("고기")) {
    const meat = /고깃집|고기집|삼겹|목살|갈비집|스테이크|숯불|구이/;
    const soup = /국밥|칼국수|찌개|해장|순대국/;
    if (meat.test(blob) && !soup.test(blob)) return true;
  }
  if (negation.excludedMenus.includes("국밥") && /국밥|순대국/.test(blob)) return true;
  return false;
}

export function softNegationScorePenalty(card: HomeCard, negation: QueryNegation | undefined | null): number {
  if (!negation?.isNegationQuery) return 0;
  const cat = cardCategory(card);
  let penalty = 0;
  if (negation.suppressedIntents.includes("MEAL") && cat === "restaurant") penalty += 42;
  if (negation.suppressedIntents.includes("CAFE") && cat === "cafe") penalty += 36;
  if (negation.excludedAttributes.includes("loud") && /노래방|클럽|펍|홀덤/.test(cardBlob(card))) penalty += 18;
  return penalty;
}

export function applyNegationToParsedQuery(
  parsed: ParsedRecommendationQuery,
  negation: QueryNegation
): ParsedRecommendationQuery {
  const out = { ...parsed, negation };
  if (!negation.isNegationQuery) return out;

  if (negation.excludedCategories.includes("cafe") && out.primaryCategory === "cafe") {
    out.primaryCategory = out.secondaryCategories?.find((c) => c !== "cafe");
    out.strongVertical = false;
    out.route = "MIXED";
  }
  if (negation.excludedCategories.includes("restaurant") && out.primaryCategory === "restaurant") {
    out.primaryCategory = out.secondaryCategories?.find((c) => c !== "restaurant");
    out.strongVertical = false;
    out.route = "MIXED";
  }
  if (negation.suppressedIntents.includes("MEAL") && out.primaryCategory === "restaurant") {
    out.primaryCategory = undefined;
    out.strongVertical = false;
    out.route = "MIXED";
  }
  if (negation.excludedVenues.length) {
    const stripped = stripExcludedVenueSurfaces(out.purposeIntents, out.menuIntents, negation.excludedVenues);
    out.purposeIntents = stripped.purposeIntents;
    out.menuIntents = stripped.menuIntents;
  }
  if (negation.excludedMenus.includes("고기")) {
    out.menuIntents = (out.menuIntents ?? []).filter((m) => m !== "고기");
    out.purposeIntents = (out.purposeIntents ?? []).filter((p) => p !== "meat");
  }
  if (out.primaryCategory && negation.excludedCategories.includes(out.primaryCategory)) {
    out.primaryCategory = undefined;
    out.strongVertical = false;
    out.route = "MIXED";
  }
  if (out.route === "CAFE" && negation.excludedCategories.includes("cafe")) out.route = "MIXED";
  if (out.route === "FOOD" && (negation.excludedCategories.includes("restaurant") || negation.suppressedIntents.includes("MEAL"))) {
    out.route = "MIXED";
    out.strongVertical = false;
  }

  if (!out.primaryCategory) {
    const purposes = new Set(negation.positivePurpose);
    if (purposes.has("CAFE") && !negation.excludedCategories.includes("cafe") && !negation.suppressedIntents.includes("CAFE")) {
      out.primaryCategory = "cafe";
      out.route = "CAFE";
      out.strongVertical = true;
    } else if (purposes.has("SOUP") && !negation.excludedCategories.includes("restaurant")) {
      out.primaryCategory = "restaurant";
      out.route = "FOOD";
      out.strongVertical = true;
    } else if (
      (purposes.has("FAMILY") || purposes.has("PLAY")) &&
      !purposes.has("DATE") &&
      !MEALISH_REMAINDER.test(negation.positiveRemainder) &&
      !negation.excludedCategories.includes("activity")
    ) {
      out.primaryCategory = "activity";
      out.route = "ACTIVITY";
      out.strongVertical = true;
    }
  }
  return out;
}

export function applyNegationToScenarioObject(obj: ScenarioObject): ScenarioObject {
  const n = obj.queryUnderstanding?.negation;
  if (!n?.isNegationQuery) return obj;
  const next = { ...obj };

  const dropCat = (cat: IntentCategory) => {
    if (next.intentCategory === cat) {
      next.intentCategory = undefined;
      next.intentStrict = false;
      if (next.intentType === "search_strict") next.intentType = "scenario_recommendation";
    }
    if (next.intentCategories?.length) {
      next.intentCategories = next.intentCategories.filter((c) => c !== cat);
      if (!next.intentCategories.length) next.intentCategories = undefined;
    }
  };

  if (n.excludedCategories.includes("cafe")) dropCat("CAFE");
  if (n.excludedCategories.includes("restaurant") || n.suppressedIntents.includes("MEAL")) dropCat("FOOD");

  if (n.suppressedIntents.includes("MEAL")) next.mealRequired = false;

  if (n.excludedContexts.includes("outdoor") || n.excludedContexts.includes("park")) {
    next.indoorPreferred = true;
    next.hardConstraints = [...new Set([...(next.hardConstraints ?? []), "indoor"])];
  }

  const menuTerms = [...(next.conversationExcludeMenuTerms ?? [])];
  if (n.excludedMenus.includes("고기")) {
    menuTerms.push("삼겹", "목살", "고깃집", "고기집", "스테이크", "숯불");
    next.menuIntent = (next.menuIntent ?? []).filter((m) => m !== "고기");
  }
  if (n.excludedVenues.length) {
    const stripped = stripExcludedVenueSurfaces(undefined, next.menuIntent, n.excludedVenues);
    next.menuIntent = stripped.menuIntents.length ? stripped.menuIntents : undefined;
    if (n.excludedVenues.includes("kids_cafe")) menuTerms.push("키즈카페", "놀이카페");
  }
  if (n.excludedVenues.includes("alcohol")) menuTerms.push("술집", "포차", "이자카야");
  if (menuTerms.length) next.conversationExcludeMenuTerms = [...new Set(menuTerms)];
  if (next.menuIntent && next.menuIntent.length === 0) next.menuIntent = undefined;

  if (n.excludedCategories.length) {
    next.excludes = [...new Set([...(next.excludes ?? []), ...n.excludedCategories])];
  }
  return next;
}

export function negationDebugFields(negation: QueryNegation | undefined | null): Record<string, unknown> {
  if (!negation) {
    return { isNegationQuery: false };
  }
  return {
    isNegationQuery: negation.isNegationQuery,
    negationPatterns: negation.patterns,
    excludedCategories: negation.excludedCategories,
    excludedMenus: negation.excludedMenus,
    excludedContexts: negation.excludedContexts,
    excludedAttributes: negation.excludedAttributes,
    suppressedIntents: negation.suppressedIntents,
    excludedVenues: negation.excludedVenues,
    positiveRemainder: negation.positiveRemainder,
    positivePurpose: negation.positivePurpose,
    hardExclusionsApplied: negation.hardExclusions,
    softSuppressionsApplied: negation.softSuppressions,
    fallbackReason: negation.fallbackReason,
  };
}
