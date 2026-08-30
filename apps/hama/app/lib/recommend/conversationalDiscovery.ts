/**
 * Lightweight deterministic conversational discovery signals.
 * Composes stem/marker patterns with optional intervening particles — not a Challenge phrase list.
 */

import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import type { DiscoveryRole } from "./discoveryRole";

export type ConversationalSemanticClass =
  | "OPEN_DECISION"
  | "SPARE_TIME"
  | "GO_OUT"
  | "BOREDOM"
  | "CHANGE_OF_SCENE"
  | "WEAK";

export type ConversationalDiscoverySignal = {
  isRecommendationSeeking: boolean;
  decisionOpenness: boolean;
  activitySeeking: boolean;
  outingSeeking: boolean;
  spareTimeSignal: boolean;
  boredomSignal: boolean;
  changeOfSceneSignal: boolean;
  confidence: number;
  evidence: string[];
  semanticClass: ConversationalSemanticClass | null;
  detected: boolean;
  blockedBySpecificIntent: boolean;
  blockReason: string | null;
};

export type ConversationalDiscoveryDebug = ConversationalDiscoverySignal & {
  focusText: string;
  isDiscoveryBeforeConversational: boolean;
  isDiscoveryAfterConversational: boolean;
  resolvedDiscoveryRole: DiscoveryRole | null;
};

function compact(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** a then up to 8 chars then b, on compact text */
function seq(c: string, a: string, b: string, gap = 8): boolean {
  const i = c.indexOf(a);
  if (i < 0) return false;
  const rest = c.slice(i + a.length, i + a.length + gap + b.length);
  return rest.includes(b);
}

function anySeq(c: string, pairs: Array<[string, string]>, gap = 8): boolean {
  return pairs.some(([a, b]) => seq(c, a, b, gap));
}

export function focusTextForDiscovery(parsed: ScenarioObject, rawQuery: string): string {
  const neg = parsed.queryUnderstanding?.negation;
  const rem = String(neg?.positiveRemainder ?? "").trim();
  const raw = String(rawQuery ?? parsed.rawQuery ?? "").trim();
  if (neg?.isNegationQuery && rem) {
    const compactRem = rem.replace(/[^\p{L}\p{N}]+/gu, "");
    // Negation v1 remainder can collapse ("나"); do not parse new markers — fall back to raw.
    if (compactRem.length >= 4) return rem;
  }
  return raw;
}

function signalsOf(c: string, spaced: string): Omit<
  ConversationalDiscoverySignal,
  "detected" | "blockedBySpecificIntent" | "blockReason" | "isRecommendationSeeking"
> {
  const evidence: string[] = [];

  const openInterrogative = /뭐|뭘|어디|어느/.test(c);
  const existenceSeeking =
    (/없나|없을까|없냐|없어|있을까/.test(c) && /뭐|뭘|어디|갈|할|놀|데|곳/.test(c)) ||
    /갈데|갈곳|할곳|할데|놀곳|놀데/.test(c);
  const decisionOpenness =
    anySeq(c, [
      ["뭐", "하"],
      ["뭐", "할"],
      ["뭐", "나을"],
      ["뭐", "좋"],
      ["뭐", "정하"],
      ["어디", "가"],
      ["어디", "갈"],
      ["어디", "좋"],
      ["어디", "나을"],
      ["어디", "해"],
      ["어디로", "가"],
      ["어느", "가"],
      ["어느", "좋"],
      ["어느", "해"],
      ["어느", "나을"],
      ["어느쪽", "가"],
      ["어느쪽", "좋"],
    ]) ||
    /뭘하|뭘해|뭘가|뭐하|뭐할/.test(c) ||
    (/갈만한|갈데|갈곳|할까|하면좋|해볼까|나을까|좋을지/.test(c) && /뭐|뭘|어디|어느/.test(c)) ||
    (/갈까|가볼까/.test(c) && !/나갈까|먹을까|마실까/.test(c)) ||
    existenceSeeking ||
    /추천좀|추천해|추천세개/.test(c);
  if (decisionOpenness) evidence.push("open_decision");

  const spareTimeSignal =
    anySeq(c, [
      ["시간", "남"],
      ["시간", "비"],
      ["시간", "있"],
      ["시간", "생겼"],
      ["한시간", "남"],
      ["한두시간", "남"],
      ["한두시간", "비"],
      ["틈", "남"],
      ["틈", "비"],
      ["여유", "있"],
      ["여유", "생겼"],
      ["공강", "비"],
      ["공강", "남"],
    ]) ||
    /자투리시간|남는시간|빈시간|잠깐시간/.test(c) ||
    (/자투리|공강|틈이|여유/.test(c) && /생겼|비었|남|있/.test(c));
  if (spareTimeSignal) evidence.push("spare_time");

  const outingSeeking =
    /나가|외출|다녀오/.test(c) ||
    (/나서|나와/.test(c) && /밖|외|집|문|현관/.test(c)) ||
    anySeq(c, [
      ["밖에", "나"],
      ["바깥", "나"],
      ["바깥", "가"],
      ["밖으", "나"],
      ["밖으", "걸"],
      ["밖으", "가"],
      ["잠깐", "나"],
      ["잠깐", "바깥"],
      ["문밖", "나"],
      ["현관", "나"],
      ["집밖", "나"],
    ]) ||
    (/나서볼|나와볼|걸어볼/.test(c) && /밖|문|현관|집/.test(c));
  if (outingSeeking) evidence.push("go_out");

  const boredomSignal =
    /심심|할게없|할거없|할일없|할거리없|놀거리없|지겨워|지겹|무료해|따분해|지루해|무료해서|따분해서|지루해서/.test(c) ||
    seq(c, "할", "없", 6);
  if (boredomSignal) evidence.push("boredom");

  const changeOfSceneSignal =
    /답답|갑갑|탁해|숨막|기분전환|환기|머리식|분위기바|바깥바람/.test(c) ||
    seq(c, "바람", "쐬", 4) ||
    seq(c, "바람", "타", 4) ||
    seq(c, "기분", "전환", 4);
  if (changeOfSceneSignal) evidence.push("change_of_scene");

  const activitySeeking = boredomSignal || /놀거|놀지|할일|할거/.test(c);
  if (activitySeeking && !evidence.includes("boredom")) evidence.push("activity_seeking");

  const weakOnly =
    !decisionOpenness &&
    !outingSeeking &&
    !boredomSignal &&
    !changeOfSceneSignal &&
    (spareTimeSignal || /심심/.test(c));

  let semanticClass: ConversationalSemanticClass | null = null;
  if (boredomSignal) semanticClass = "BOREDOM";
  else if (changeOfSceneSignal) semanticClass = "CHANGE_OF_SCENE";
  else if (outingSeeking && (!decisionOpenness || !openInterrogative)) semanticClass = "GO_OUT";
  else if (spareTimeSignal && !decisionOpenness) semanticClass = "SPARE_TIME";
  else if (decisionOpenness) semanticClass = "OPEN_DECISION";
  else if (weakOnly) semanticClass = "WEAK";

  let confidence = 0;
  if (decisionOpenness) confidence += 0.42;
  if (spareTimeSignal) confidence += 0.28;
  if (outingSeeking) confidence += 0.3;
  if (boredomSignal) confidence += 0.38;
  if (changeOfSceneSignal) confidence += 0.32;
  if (weakOnly) confidence = Math.max(confidence, 0.4);
  if (c.length <= 6 && (decisionOpenness || spareTimeSignal || outingSeeking || boredomSignal)) confidence += 0.08;
  confidence = Math.min(1, confidence);

  void spaced;
  return {
    decisionOpenness,
    activitySeeking,
    outingSeeking,
    spareTimeSignal,
    boredomSignal,
    changeOfSceneSignal,
    confidence,
    evidence,
    semanticClass,
  };
}

export function specificIntentBlockReason(parsed: ScenarioObject): string | null {
  const menus = [
    ...(parsed.menuIntent ?? []),
    ...(parsed.catalogMenu?.resolvedMenuIntent ?? []),
    ...(parsed.queryUnderstanding?.menuIntents ?? []),
  ].filter(Boolean);
  if (parsed.catalogMenu?.catalogMenuPrimary) return "resolvedMenuIntent";
  if (menus.length) return "menuIntent";
  if (parsed.queryUnderstanding?.strongVertical) return "strongVertical";
  if (parsed.intentType === "search_strict" && parsed.intentCategory) {
    if (parsed.intentCategory === "FOOD") return "food_strict";
    if (parsed.intentCategory === "CAFE") return "cafe_strict";
    if (parsed.intentCategory === "ACTIVITY") return "activity_strict";
    if (parsed.intentCategory === "BEAUTY") return "beauty_strict";
    return "search_strict";
  }
  return null;
}

/** Meal-seeking constructions — not past-complete "먹었" and not bare 점심/저녁. */
export const MEAL_SEEKING_FOCUS =
  /맛집|식당|밥집|외식|회식|고깃집|고기집|해장|분식|칼국수|냉면|돈가|돈까|짬뽕|치킨|피자|먹지|먹을까|먹을\s*곳|먹\s*을까|밥\s*먹(?!었)|저녁\s*먹(?!었)|점심\s*먹(?!었)/;
export const CAFE_SEEKING_FOCUS = /카페|커피|디저트|베이커리|빵집|브런치/;
export const VENUE_SEEKING_FOCUS =
  /키즈\s*카페|키즈카페|놀이카페|키즈룸|보드게임|방탈출|영화|실내\s*놀이/;

export function isMealSeekingFocus(focus: string): boolean {
  return MEAL_SEEKING_FOCUS.test(focus);
}

export function isCafeSeekingFocus(focus: string): boolean {
  return CAFE_SEEKING_FOCUS.test(focus);
}

export function isVenueSeekingFocus(focus: string): boolean {
  return VENUE_SEEKING_FOCUS.test(focus);
}

/** Vague play-seeking (놀거리/할거리/심심) is not a specific activity venue. */
export function isGenericPlaySeekingWithoutVenue(focus: string): boolean {
  if (isVenueSeekingFocus(focus)) return false;
  const c = compact(focus);
  return /놀거리|할거리|할거없|할게없|할일없|심심|무료해|따분해|지루해/.test(c);
}

export function detectConversationalDiscovery(
  rawQuery: string,
  parsed: ScenarioObject
): ConversationalDiscoverySignal {
  const focus = focusTextForDiscovery(parsed, rawQuery);
  const c = compact(focus);
  const base = signalsOf(c, focus);
  let block = specificIntentBlockReason(parsed);
  if (block === "activity_strict" && isGenericPlaySeekingWithoutVenue(focus)) {
    block = null;
  }
  const isRecommendationSeeking =
    Boolean(base.semanticClass) &&
    (base.decisionOpenness ||
      base.outingSeeking ||
      base.boredomSignal ||
      base.changeOfSceneSignal ||
      (base.spareTimeSignal && base.confidence >= 0.28) ||
      base.semanticClass === "WEAK");

  const excluded = parsed.queryUnderstanding?.negation?.excludedCategories ?? [];
  if (!block) {
    if (isMealSeekingFocus(focus) && !excluded.includes("restaurant")) {
      return {
        ...base,
        isRecommendationSeeking,
        detected: false,
        blockedBySpecificIntent: true,
        blockReason: "explicit_meal",
      };
    }
    if (isCafeSeekingFocus(focus) && !excluded.includes("cafe")) {
      return {
        ...base,
        isRecommendationSeeking,
        detected: false,
        blockedBySpecificIntent: true,
        blockReason: "explicit_cafe",
      };
    }
    if (isVenueSeekingFocus(focus)) {
      return {
        ...base,
        isRecommendationSeeking,
        detected: false,
        blockedBySpecificIntent: true,
        blockReason: "explicit_venue",
      };
    }
  }

  if (block) {
    return {
      ...base,
      isRecommendationSeeking,
      detected: false,
      blockedBySpecificIntent: true,
      blockReason: block,
    };
  }

  const detected = isRecommendationSeeking && (base.confidence >= 0.35 || Boolean(base.semanticClass && base.semanticClass !== "WEAK") || (base.semanticClass === "WEAK" && base.confidence >= 0.4));
  return {
    ...base,
    isRecommendationSeeking,
    detected,
    blockedBySpecificIntent: false,
    blockReason: detected ? null : base.semanticClass ? "low_confidence" : "no_signal",
  };
}

export function conversationalClassToRole(
  semanticClass: ConversationalSemanticClass | null,
  parsed: ScenarioObject
): DiscoveryRole {
  if (parsed.scenario === "date") return "DATE";
  if (parsed.withKids || parsed.scenario === "family_kids" || parsed.scenario === "family") {
    if (semanticClass === "GO_OUT" || semanticClass === "BOREDOM" || semanticClass === "OPEN_DECISION" || semanticClass === "SPARE_TIME") {
      return "FAMILY_OUTING";
    }
  }
  switch (semanticClass) {
    case "BOREDOM":
      return "PLAY";
    case "CHANGE_OF_SCENE":
      return /야외|날씨|바람|바깥|공원/.test(compact(parsed.rawQuery ?? "")) ? "OUTDOOR" : "RELAX";
    case "GO_OUT":
      return /야외|날씨좋|바깥|바람/.test(compact(parsed.rawQuery ?? "")) ? "OUTDOOR" : "OPEN_DISCOVERY";
    case "SPARE_TIME":
      return "OPEN_DISCOVERY";
    case "OPEN_DECISION":
    case "WEAK":
    default:
      return "OPEN_DISCOVERY";
  }
}

export function conversationalDiscoveryDebugFields(
  signal: ConversationalDiscoverySignal | undefined | null
): Record<string, unknown> {
  if (!signal) {
    return {
      conversationalDiscovery: null,
    };
  }
  return {
    conversationalDiscovery: {
      detected: signal.detected,
      confidence: signal.confidence,
      semanticClass: signal.semanticClass,
      evidence: signal.evidence,
      blockedBySpecificIntent: signal.blockedBySpecificIntent,
      blockReason: signal.blockReason,
    },
  };
}
