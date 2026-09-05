import { normIntentQuery } from "./intentQueryNormalize";

/**
 * Neutral generic dining-out inflections.
 * Bare "외식" / "회식" are intentionally excluded so family/date/etc keep their own path.
 */
const NEUTRAL_DINING_OUT_PH = /외식(?:할|할까|하러|하고|해서|해도)/;

const STRONGER_FAMILY_PH = /가족|아이랑|아이들이|아이들이랑|애들|아이\s|유아|키즈|초등|육아/;
const STRONGER_DATE_PH = /데이트|연인|커플|여자친구|남자친구/;
const STRONGER_RELAX_PH =
  /조용|힐링|책\s*읽|시간\s*때울|시간\s*보내|쉬(?:다|고|기)|머물|차분/;

export function hasStrongerDiningOutOverrideContext(rawQuery: string): boolean {
  const q = normIntentQuery(rawQuery);
  if (!q) return false;
  if (STRONGER_FAMILY_PH.test(q)) return true;
  if (STRONGER_DATE_PH.test(q)) return true;
  if (/실내/.test(q) && /놀/.test(q)) return true;
  if (STRONGER_RELAX_PH.test(q)) return true;
  return false;
}

export function isNeutralGenericDiningOutQuery(rawQuery: string): boolean {
  const q = normIntentQuery(rawQuery);
  if (!q) return false;
  if (hasStrongerDiningOutOverrideContext(q)) return false;
  return NEUTRAL_DINING_OUT_PH.test(q);
}

/** Hint-count hits from bare 외식/회식 only. Used to undo global FOOD_HINTS leakage. */
export function diningOutBareHintHits(normalizedQuery: string): number {
  const q = String(normalizedQuery ?? "");
  let n = 0;
  if (q.includes("외식")) n += 1;
  if (q.includes("회식")) n += 1;
  return n;
}
