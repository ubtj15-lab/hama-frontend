import type { HomeCard } from "@/lib/storeTypes";
import {
  computeFamilyPlaceProfile,
  familyKidsFishRiskMitigationTagsPresent,
  isFamilyKidsFishStewRiskHaystack,
  parentGatheringOrRestorativeQuery,
} from "@/lib/recommend/placeFamilyClassification";

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

const FISH_RAW_HARD_EXCLUDE_INDEX = new Set([0, 1, 12]);

export function haystackForKids(card: HomeCard): string {
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
 * 0~100. 아이 동반 적합도(가산·감점 명시 규칙).
 * @see childFriendlyScore — UI·랭킹은 0~1 정규화
 */
export function childFriendlyPoints(card: HomeCard): number {
  const prof = computeFamilyPlaceProfile(card);
  const h = haystackForKids(card);
  let p = 50;

  if (/아이\s*메뉴|어린이\s*메뉴|아이메뉴/.test(h)) p += 20;
  if (/키즈존|키즈\s*룸/.test(h)) p += 20;
  if (/유아\s*의자|아기\s*의자/.test(h)) p += 15;
  if (/좌석\s*넓|넓은\s*좌석/.test(h)) p += 15;
  if (/주차\s*가능|주차장/.test(h)) p += 15;
  if (/맵지\s*않|맵지않은|안\s*맵|순한\s*맛|아이\s*입맛/.test(h)) p += 15;
  if (/웨이팅\s*적|대기\s*적|바로\s*입장/.test(h)) p += 10;
  if (/유모차/.test(h)) p += 10;
  if (/실내\s*넓|넓은\s*실내/.test(h)) p += 10;

  if (/돈까스|돈가스|한식|분식|국밥|백반|죽|샤브|파스타|덮밥|떡볶이|김밥/.test(h)) p += 12;

  if (prof.servingType === "drink_only") p -= 40;
  if (/술집|포차|이자카야|주점|(?:^|\s)bar(?:\s|$)|와인\s*바|맥주\s*집|소주\s*방|펍\b|pub\b/.test(h)) p -= 40;
  if (/횟집|회\s*전문|사시미|오마카세|장어\s*전문|스시\s*전문/.test(h)) p -= 35;
  if (isFamilyKidsFishStewRiskHaystack(h)) {
    p -= familyKidsFishRiskMitigationTagsPresent(card) ? 32 : 48;
  }
  if (/맵기\s*조절|매운\s*전문|극한\s*매운맛|핵\s*매움/.test(h)) p -= 30;
  if (/회식\s*형|회식\s*전문|단체\s*회식/.test(h)) p -= 25;
  if (/좌석\s*좁|좁은\s*좌석/.test(h)) p -= 20;
  if (/웨이팅\s*길|대기\s*길|줄\s*서기/.test(h)) p -= 20;

  if ((card as any).with_kids === true) p += 10;

  return Math.max(0, Math.min(100, p));
}

/**
 * 0~1. 아이 동반 적합도.
 */
export function childFriendlyScore(card: HomeCard): number {
  return childFriendlyPoints(card) / 100;
}

/**
 * 하드 제외: 가족·아이 코스 풀·레거시 호환.
 * `rawQuery` 가 있으면 부모님·보양식·가족모임 맥락에서 횟집·회 중심 매장만 완화.
 */
export function isHardExcludedForKidsScenario(card: HomeCard, opts?: { rawQuery?: string }): boolean {
  const raw = String(opts?.rawQuery ?? "");
  const allowParent = parentGatheringOrRestorativeQuery(raw);
  const h = haystackForKids(card);
  const prof = computeFamilyPlaceProfile(card);
  const cat = String(card.category ?? "").toLowerCase();

  if (cat === "bar" || /(?:wine|pub)/i.test(cat)) return true;
  if (prof.alcohol_focused) return true;

  if (prof.familySuitability === "risky_for_kids" || prof.mealRisk === "high") {
    if (!allowParent) return true;
    if (/술집|포차|이자카야|주점|(?:^|\s)bar|와인\s*바|맥주\s*집|소주\s*방|펍|pub/i.test(h)) return true;
  }

  for (let i = 0; i < HARD_EXCLUDE_RE.length; i++) {
    const re = HARD_EXCLUDE_RE[i]!;
    if (!re.test(h)) continue;
    if (allowParent && FISH_RAW_HARD_EXCLUDE_INDEX.has(i)) continue;
    return true;
  }

  for (const kw of FAMILY_EXCLUDE_KEYWORDS) {
    if (kw === "술") {
      if (/(?:술집|주점|포차|맥주|소주|이자카야|야경\s*술)/.test(h)) return true;
      continue;
    }
    if (h.includes(String(kw).toLowerCase())) {
      if (allowParent && (kw === "횟집" || kw === "사시미")) continue;
      return true;
    }
  }

  return false;
}

/** UI 문구: "아이랑 가기 좋아요" 등 금지 여부 */
export function shouldBlockKidFriendlyMessaging(card: HomeCard): boolean {
  return isHardExcludedForKidsScenario(card) || childFriendlyScore(card) < 0.38;
}
