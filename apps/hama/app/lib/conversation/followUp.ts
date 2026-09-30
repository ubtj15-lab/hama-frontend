import type { FoodSubCategory, IntentCategory } from "@/lib/scenarioEngine/types";

function norm(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The user is replacing the trip, not adding to it. */
export function isExplicitNewSearch(text: string): boolean {
  return /처음부터|바꿔\s*줘|바꿔줘|다시\s*찾|대신/.test(norm(text));
}

/**
 * A follow-up that adds a purpose to the current trip.
 * "도", "넣어", and "포함" add. "바꿔" does not.
 */
export function isAdditivePurpose(text: string): boolean {
  const q = norm(text);
  if (isExplicitNewSearch(q)) return false;
  if (isNearbyShownMeal(q)) return true;
  if (/넣어|포함/.test(q)) return true;
  return /도/.test(q) && /밥|식사|먹을|맛집|식당|디저트|간식/.test(q);
}

/** A meal beside places already shown, including sentences without "도". */
export function isNearbyShownMeal(text: string): boolean {
  const q = norm(text);
  if (!/밥\s*먹|식사|먹을\s*곳|맛집|식당/.test(q)) return false;
  if (/(추천한|보여\s*준|보여준|방금|아까).{0,30}(근처|주변|가까이)/.test(q)) return true;
  return /그\s*주변/.test(q);
}

export const OTHER_KIND_PROMPT = "놀이, 식당, 카페, 박물관 중에서 어떤 종류로 바꿀까요?";

export function asksOtherVenueKind(text: string): boolean {
  return /다른\s*(종류|업종|유형)/.test(norm(text));
}

/** A follow-up that names the next place type. Broad outing sentences are not a choice. */
export function explicitVenueChoice(text: string): IntentCategory | null {
  const q = norm(text);
  if (/박물관|미술관|도서관|전시/.test(q)) return "ACTIVITY";
  if (/놀이/.test(q) && !asksOtherVenueKind(q)) return "ACTIVITY";
  if (/식당|맛집/.test(q) && !asksOtherVenueKind(q)) return "FOOD";
  if (/카페/.test(q) && !/키즈\s*카페|키즈카페/.test(q) && !asksOtherVenueKind(q)) return "CAFE";
  return null;
}

const VENUE_WORD: Record<string, RegExp> = {
  박물관: /박물관/,
  미술관: /미술관/,
  도서관: /도서관/,
  전시: /전시/,
};

/** Keep only stores whose own text matches a named venue. An empty list stays empty. */
export function cardsForNamedVenue<T extends { name?: string | null; tags?: string[] | null; description?: string | null }>(
  text: string,
  cards: readonly T[]
): T[] {
  const q = norm(text);
  if (/말고|제외|빼/.test(q)) return [...cards];
  const word = Object.keys(VENUE_WORD).find((key) => q.includes(key));
  if (!word) return [...cards];
  const pattern = VENUE_WORD[word]!;
  return cards.filter((card) => pattern.test([card.name, card.description, ...(card.tags ?? [])].filter(Boolean).join(" ")));
}

/**
 * No search frame of its own, so an existing trip should keep its region,
 * companion, and purpose. A full outing question is not a fragment.
 */
export function isDependentFollowUp(text: string): boolean {
  const q = norm(text);
  if (isExplicitNewSearch(q)) return false;
  if (isAdditivePurpose(q)) return true;
  if (/추천|찾아\s*줘|찾아줘|갈\s*(곳|데)|어디|가고\s*싶|먹으러|놀\s*만한|데이트할|코스\s*짜/.test(q)) {
    return false;
  }
  return true;
}

/** Cuisine the user is dropping, not ordering. Menu-only phrases such as 짜장면 말고 are not included. */
export function negatedFoodSub(text: string): FoodSubCategory | null {
  const q = norm(text);
  if (/(중식|중국)\s*도?\s*말고|(중식|중국)[은는이가]?\s*아니/.test(q)) return "CHINESE";
  if (/일식\s*도?\s*말고|일본\s*도?\s*말고|일식[은는이가]?\s*아니/.test(q)) return "JAPANESE";
  if (/한식\s*도?\s*말고|한식[은는이가]?\s*아니/.test(q)) return "KOREAN";
  if (/양식\s*도?\s*말고|양식[은는이가]?\s*아니/.test(q)) return "WESTERN";
  if (/분식\s*도?\s*말고|분식[은는이가]?\s*아니/.test(q)) return "FASTFOOD";
  return null;
}

/** A venue word that should update the current category without resetting the trip. */
export function venueVertical(text: string): IntentCategory | null {
  const q = norm(text);
  if (isAdditivePurpose(q)) return null;
  if (/카페/.test(q)) {
    if (/키즈\s*카페|키즈카페|놀이카페/.test(q) && /제외|빼\s*줘|빼줘|말고/.test(q)) return null;
    return "CAFE";
  }
  if (/미용|네일|헤어/.test(q)) return "BEAUTY";
  if (/놀이/.test(q) && !/밥|식사|식당|맛집/.test(q)) return "ACTIVITY";
  return null;
}
