import type { ConversationContext } from "./types";

export type ShownExclusion =
  | { kind: "none" }
  | { kind: "all" }
  | { kind: "ids"; ids: string[] }
  | { kind: "ambiguous" };

const EXPLICIT_SHOWN_SET =
  /아까\s*(본|나왔|그)|방금\s*(본|나왔)|보여\s*준|보여준|나온\s*(데|곳|집)|다른\s*데|다른데|다른\s*곳|다른곳|이거\s*말고|별로|전부|다\s*빼|다\s*제외/;

/** Another place of the same kind, not another menu, region, or a negated category. */
function wholeShownSet(q: string): boolean {
  if (/다른\s*(메뉴|지역|동네|시간|날|업종)/.test(q)) return false;
  if (/다른\s*(식당|집|가게|카페|매장).{0,10}(아니|말고)/.test(q)) return false;
  return (
    /다른\s*(식당|집|가게|카페|매장)/.test(q) ||
    /이\s*목록.{0,8}말고/.test(q) ||
    /(나온|보여\s*준)\s*(식당|곳|데|집).{0,8}(말고|빼)/.test(q)
  );
}

const SINGULAR_ANAPHOR = /그\s*(식당|카페|곳|데|매장|집|가게)|저\s*(식당|카페|곳|집)|거기/;
const EXCLUSION_VERB = /빼\s*줘|빼줘|제외|가\s*봤|가봤|말고|안\s*갈|패스|별로/;

function pluralShownSet(q: string): boolean {
  return /그\s*(식당|카페|곳|데|매장|집|가게)들/.test(q) && EXCLUSION_VERB.test(q);
}
const CUISINE_OR_MENU =
  /(한식|일식|중식|양식|분식|중국|일본)\s*도?\s*말고|(짜장면|짬뽕|초밥|돈까스|국밥|파스타)\s*말고/;

function norm(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compact(text: string): string {
  return text.replace(/\s+/g, "");
}

function shownCards(previous: ConversationContext | null): Array<{ id: string; name: string }> {
  const rec = previous?.lastRecommendations;
  const fromCards = (rec?.cards ?? [])
    .map((card) => ({ id: String(card?.id ?? "").trim(), name: String(card?.name ?? "").trim() }))
    .filter((card) => card.id);
  if (fromCards.length) return fromCards;
  return (rec?.placeIds ?? []).map((id) => ({ id: String(id).trim(), name: "" })).filter((card) => card.id);
}

function mentionsCard(utterance: string, name: string): boolean {
  const spoken = compact(utterance);
  const full = compact(name);
  if (full.length < 2 || !spoken.includes(full)) {
    const withoutArea = full.replace(/^(동탄역|동탄1|동탄2|북광장|동탄|오산|평택|병점)/, "");
    return withoutArea.length >= 2 && spoken.includes(withoutArea);
  }
  return true;
}

/**
 * Decide which already shown places an utterance excludes.
 * A unique name excludes that place. A phrase about the whole shown set excludes all.
 * A singular "that place" with several cards asks instead of dropping every card.
 */
export function classifyShownExclusion(text: string, previous: ConversationContext | null): ShownExclusion {
  const q = norm(text);
  if (!q || CUISINE_OR_MENU.test(q)) return { kind: "none" };
  const cards = shownCards(previous);
  if (!cards.length) return { kind: "none" };

  const named = cards.filter((card) => card.name && mentionsCard(q, card.name));
  const wantsOut = EXCLUSION_VERB.test(q);
  if (named.length === 1 && wantsOut) return { kind: "ids", ids: [named[0]!.id] };
  if (named.length > 1 && wantsOut) return { kind: "ids", ids: named.map((card) => card.id) };
  if (pluralShownSet(q) || wholeShownSet(q)) return { kind: "all" };
  if (EXPLICIT_SHOWN_SET.test(q)) return { kind: "all" };
  if (SINGULAR_ANAPHOR.test(q) && wantsOut) {
    if (cards.length === 1) return { kind: "ids", ids: [cards[0]!.id] };
    return { kind: "ambiguous" };
  }
  if (/가\s*봤|가봤/.test(q) && named.length === 0 && cards.length > 1) return { kind: "ambiguous" };
  return { kind: "none" };
}

export const AMBIGUOUS_PLACE_PROMPT = "보여 드린 곳 중에서 어느 곳을 빼면 될지 알려 주세요.";
