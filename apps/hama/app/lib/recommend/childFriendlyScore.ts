import type { HomeCard } from "@/lib/storeTypes";

/** 아이 동반 시나리오에서 하드 제외·문구 금지에 쓰는 키워드(부분 문자열) */
export const FAMILY_EXCLUDE_KEYWORDS = [
  "횟집",
  "사시미",
  "주점",
  "포차",
  "bar",
  "술집",
  "술",
] as const;

const HARD_EXCLUDE_RE: RegExp[] = [
  /횟집/,
  /사시미/,
  /(?:^|[\s,./(])bar(?:$|[\s,.)])/i,
  /포차/,
  /주점/,
  /술집/,
  /이자카야/,
  /야경\s*술집/,
  /룸\s*주점/,
  /(?:성인|미성년)\s*전용/,
  /(?:19|십구)\s*세\s*이상/,
  /미성년자\s*입장\s*불가/,
  /(?:^|\s)회(?:전|초밥|덮밥|뜯|포장)/,
];

/** 감점: 술·야식·고급 주점류 */
const PENALTY_RES: { re: RegExp; w: number }[] = [
  { re: /횟집|회\s*전문|스시|초밥|사시미|오마카세/i, w: 0.22 },
  { re: /포차|주점|술집|이자카야|(?:^|\s)bar(?:$|\s)/i, w: 0.22 },
  { re: /맥주\s*집|소주\s*방|와인\s*바|칵테일|펍|pub/i, w: 0.2 },
  { re: /야식|한잔|술\s*안주|안주\s*전문/i, w: 0.12 },
  { re: /조용한\s*프라이빗|고급\s*다이닝|코스\s*요리\s*전문/i, w: 0.1 },
  { re: /성인\s*중심|데이트\s*술집|회식\s*전문|단체\s*회식/i, w: 0.12 },
];

/** 가산: 가족·아이 동반 친화 */
const BONUS_RES: { re: RegExp; w: number }[] = [
  { re: /가족|가족식당|키즈|키즈존|유아|아이\s*동반|어린이/i, w: 0.14 },
  { re: /돈까스|돈가스|한식|분식|백반|국밥|죽|떡볶이|김밥/i, w: 0.08 },
  { re: /좌석\s*넓|넓은\s*좌석|유아\s*의자|놀이\s*방|키즈\s*메뉴/i, w: 0.1 },
  { re: /유모차|웨이팅\s*적|대기\s*적|바로\s*입장|아이\s*메뉴|어린이\s*메뉴/i, w: 0.08 },
  { re: /활동적|소란|가족\s*분위기|떠들|아이\s*소음/i, w: 0.05 },
];

function haystack(card: HomeCard): string {
  const parts = [
    card.name,
    card.category,
    card.categoryLabel,
    ...(card.tags ?? []),
    ...(card.mood ?? []),
    (card as any).description,
    ...(Array.isArray((card as any).menu_keywords) ? (card as any).menu_keywords : []),
  ]
    .filter(Boolean)
    .join(" ");
  return parts.toLowerCase();
}

/**
 * 0~1. 아이 동반 적합도 (휴리스틱).
 * - DB `with_kids === true` 이면 가산
 */
export function childFriendlyScore(card: HomeCard): number {
  const h = haystack(card);
  if ((card as any).with_kids === true) {
    let s = 0.72;
    for (const { re, w } of BONUS_RES) {
      if (re.test(h)) s += w * 0.5;
    }
    for (const { re, w } of PENALTY_RES) {
      if (re.test(h)) s -= w;
    }
    return Math.max(0, Math.min(1, s));
  }

  let s = 0.5;
  for (const { re, w } of BONUS_RES) {
    if (re.test(h)) s += w;
  }
  for (const { re, w } of PENALTY_RES) {
    if (re.test(h)) s -= w;
  }
  return Math.max(0, Math.min(1, s));
}

/** 하드 제외: 아이랑(family_kids·parent_child_outing) 추천 풀 */
export function isHardExcludedForKidsScenario(card: HomeCard): boolean {
  const h = haystack(card);
  for (const re of HARD_EXCLUDE_RE) {
    if (re.test(h)) return true;
  }
  for (const kw of FAMILY_EXCLUDE_KEYWORDS) {
    if (kw === "술") {
      if (/(?:술집|주점|포차|맥주|소주|이자카야|야경\s*술)/.test(h)) return true;
      continue;
    }
    if (h.includes(String(kw).toLowerCase())) return true;
  }
  const cat = String(card.category ?? "").toLowerCase();
  if (cat === "bar" || /(?:wine|pub)/i.test(cat)) return true;
  return false;
}

/** UI 문구: "아이랑 가기 좋아요" 등 금지 여부 */
export function shouldBlockKidFriendlyMessaging(card: HomeCard): boolean {
  return isHardExcludedForKidsScenario(card) || childFriendlyScore(card) < 0.38;
}
