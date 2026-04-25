import type { HomeCard } from "@/lib/storeTypes";
import type { PlaceType, ScenarioObject } from "@/lib/scenarioEngine/types";
import { normalizeCategory } from "@/lib/recommend/scenarioCategoryRules";

/** 랭킹·코스 공통 — DB servingType 과 별개의 추론 축 */
export type FamilyServingKind = "meal" | "light_meal" | "drink_only" | "activity_only";

export type FamilySuitability = "kids_safe" | "kids_ok" | "adult_family" | "risky_for_kids";

export type FamilyMealRisk = "low" | "medium" | "high";

export type FamilyPlaceProfile = {
  servingType: FamilyServingKind;
  familySuitability: FamilySuitability;
  mealRisk: FamilyMealRisk;
  alcohol_focused: boolean;
  adult_mood: boolean;
};

/** 부모님·가족 모임·생선 요청 등 — 횟집·고위험 생선조림 를 쿼리 맥락상 허용 */
const PARENT_GATHERING_OR_RESTORATIVE =
  /부모님|보양식|가족모임|어버이|어른\s*(모시|동반|들\s*식사)|가족\s*외식\s*모임|코다리|생선요리/i;

/** 아이 기본 추천에서 강한 감점·하드 제외 대상 생선·찜 키워드 */
const FISH_KIDS_RISKY_KEYWORDS =
  /코다리(?:\s*조림)?|생선\s*조림|생선조림|매운\s*생선|매운생선|해물찜|아구찜/i;

const FISH_KIDS_RISKY_SPICY_STEW = /매운\s*생선|매운생선|해물찜|아구찜/i;

const CAFE_MEALISH_TAGS =
  /브런치|베이커리|디저트|키즈존|아이\s*동반|유아\s*동반|키즈\s*메뉴|아이\s*메뉴|식사|파스타|라면|샌드위치|샐러드|와플|팬케이크|토스트|케이크|샐러드바/i;

const KIDS_SAFE_MEAL =
  /돈까스|돈가스|한식|분식|파스타|샤브|죽\s*전문|죽집|백반|국밥|덮밥|떡볶이|김밥|우동|칼국수|짜장|짬뽕|순대|보쌈|족발|막국수/i;

const DRINK_CAFE_CHAIN =
  /^(?:스타벅스|메가\s*커피|메가커피|컴포즈|빽다방|이디야|투썸|파스쿠찌|할리스|엔제리너스|카페베네|매머드|폴바셋|탐앤탐스)/i;

function firstToken(name: string): string {
  return String(name ?? "")
    .trim()
    .split(/[\s|,(]+/)[0]!
    .toLowerCase();
}

function isChainDrinkCafeName(name: string): boolean {
  const n = String(name ?? "").trim();
  if (!n) return false;
  return DRINK_CAFE_CHAIN.test(firstToken(n)) || DRINK_CAFE_CHAIN.test(n);
}

const RAW_OR_ADULT_VENUE =
  /횟집|사시미|오마카세|장어\s*전문|(?:^|\s)회(?:\s*전문|\s*뜯)|스시|초밥\s*전문|술집|포차|이자카야|주점|(?:^|\s)bar(?:\s|$)|와인\s*바|맥주\s*집|소주\s*방|펍\b|pub\b/i;

const ALCOHOL_FOCUS =
  /술집|포차|이자카야|주점|(?:^|\s)bar(?:\s|$)|와인\s*바|맥주\s*집|소주\s*방|펍\b|pub\b|술\s*무한|무한\s*리필\s*주류/i;

const ADULT_MOOD =
  /성인\s*전용|(?:19|십구)\s*세|미성년\s*입장\s*불가|데이트\s*술|야식\s*한잔|룸\s*주점|조용한\s*프라이빗|고급\s*다이닝\s*전문|회식\s*전문|단체\s*회식\s*전문/i;

const SPICY_FOCUS = /맵기\s*조절|매운맛\s*전문|극한\s*매운맛|핵\s*매움|천연\s*조미\s*맵십/i;

const NARROW_SEAT = /좌석\s*좁|좁은\s*좌석|1인\s*석\s*위주/i;

const LONG_WAIT = /웨이팅\s*길|대기\s*길|줄\s*서기\s*힘든|예약\s*필수\s*대기/i;

function fullHay(card: HomeCard): string {
  const c = card as any;
  return [
    c?.name,
    c?.category,
    c?.categoryLabel,
    ...(card.tags ?? []),
    ...(card.mood ?? []),
    typeof c?.description === "string" ? c.description : "",
    ...(Array.isArray(c?.menu_keywords) ? c.menu_keywords : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function parentGatheringOrRestorativeQuery(q: string): boolean {
  return PARENT_GATHERING_OR_RESTORATIVE.test(String(q ?? "").toLowerCase());
}

export function isFamilyKidsFishStewRiskHaystack(h: string): boolean {
  return FISH_KIDS_RISKY_KEYWORDS.test(String(h ?? "").toLowerCase());
}

/** 아이메뉴·돈까스·순한맛·넓은 좌석 등 — 생선 위험 매장 완전 제외 대신 감점만 */
export function familyKidsFishRiskMitigationTagsPresent(card: HomeCard): boolean {
  const h = fullHay(card);
  return /아이\s*메뉴|어린이\s*메뉴|아이메뉴|돈까스|돈가스|맵지\s*않|맵지않은|안\s*맵|순한\s*맛|좌석\s*넓|넓은\s*좌석/.test(h);
}

export function computeFamilyPlaceProfile(card: HomeCard): FamilyPlaceProfile {
  const cat = normalizeCategory(card);
  const h = fullHay(card);
  const dbServing = String((card as any).servingType ?? "").toLowerCase();

  let alcohol_focused = ALCOHOL_FOCUS.test(h);
  let adult_mood = ADULT_MOOD.test(h);
  if (/(?:무알콜|논알콜|주류\s*없)/.test(h)) {
    alcohol_focused = false;
    adult_mood = adult_mood && !/술집|포차|이자카야|주점/.test(h);
  }

  if (cat === "activity") {
    return {
      servingType: "activity_only",
      familySuitability: /키즈|유아|어린이|가족|실내/.test(h) ? "kids_safe" : "kids_ok",
      mealRisk: "low",
      alcohol_focused,
      adult_mood,
    };
  }

  if (RAW_OR_ADULT_VENUE.test(h)) {
    const risky = /횟집|사시미|오마카세|장어|스시|초밥|회\s*전문|회뜯/.test(h);
    return {
      servingType: /술집|포차|bar|이자카야|주점|와인|맥주|소주|펍/.test(h) ? "drink_only" : "meal",
      familySuitability: risky ? "risky_for_kids" : "adult_family",
      mealRisk: "high",
      alcohol_focused: alcohol_focused || ALCOHOL_FOCUS.test(h),
      adult_mood: adult_mood || /회식|단체|프라이빗/.test(h),
    };
  }

  if (cat === "restaurant" && FISH_KIDS_RISKY_KEYWORDS.test(h)) {
    return {
      servingType: "meal",
      familySuitability: FISH_KIDS_RISKY_SPICY_STEW.test(h) ? "risky_for_kids" : "adult_family",
      mealRisk: "high",
      alcohol_focused,
      adult_mood,
    };
  }

  if (cat === "cafe") {
    const chainDrink = isChainDrinkCafeName(String(card.name ?? ""));
    const mealish = CAFE_MEALISH_TAGS.test(h) || dbServing === "meal" || dbServing === "light";
    if (chainDrink && !mealish) {
      return {
        servingType: "drink_only",
        familySuitability: "kids_ok",
        mealRisk: "medium",
        alcohol_focused,
        adult_mood,
      };
    }
    if (mealish || /브런치|베이커리|식사|샌드위치|샐러드|파스타|라면|도시락/.test(h)) {
      return {
        servingType: "light_meal",
        familySuitability: "kids_ok",
        mealRisk: "low",
        alcohol_focused,
        adult_mood,
      };
    }
    return {
      servingType: "drink_only",
      familySuitability: "kids_ok",
      mealRisk: "medium",
      alcohol_focused,
      adult_mood,
    };
  }

  if (cat === "restaurant") {
    if (KIDS_SAFE_MEAL.test(h)) {
      return {
        servingType: /브런치|샐러드|샌드위치|라이트|가벼운/.test(h) ? "light_meal" : "meal",
        familySuitability: "kids_safe",
        mealRisk: "low",
        alcohol_focused,
        adult_mood,
      };
    }
    if (SPICY_FOCUS.test(h) || LONG_WAIT.test(h)) {
      return {
        servingType: "meal",
        familySuitability: "kids_ok",
        mealRisk: "medium",
        alcohol_focused,
        adult_mood,
      };
    }
    return {
      servingType: "meal",
      familySuitability: /회식|단체|프라이빗|야식|한잔/.test(h) ? "adult_family" : "kids_ok",
      mealRisk: "medium",
      alcohol_focused,
      adult_mood,
    };
  }

  return {
    servingType: "meal",
    familySuitability: "kids_ok",
    mealRisk: "medium",
    alcohol_focused,
    adult_mood,
  };
}

/** 단일 장소 추천(family_kids) 하드 필터 — 폴백에서도 동일 적용 */
export function isHardExcludedForFamilyKidsListRecommend(
  card: HomeCard,
  scenarioObject: ScenarioObject,
  searchQuery: string | null | undefined
): boolean {
  const q = `${scenarioObject.rawQuery ?? ""} ${searchQuery ?? ""}`.toLowerCase();
  const prof = computeFamilyPlaceProfile(card);
  const h = fullHay(card);
  const allowParent = parentGatheringOrRestorativeQuery(q);

  if (prof.alcohol_focused) return true;
  if (prof.adult_mood) return true;
  if (prof.servingType === "drink_only") return true;

  if (prof.familySuitability === "risky_for_kids" || prof.mealRisk === "high") {
    const fishStew = isFamilyKidsFishStewRiskHaystack(h);
    const fishMitigated = fishStew && familyKidsFishRiskMitigationTagsPresent(card);
    if (!fishMitigated && !allowParent) return true;
  }

  const cat = String(card.category ?? "").toLowerCase();
  if (cat === "cafe") {
    const cafeOk = prof.servingType === "light_meal" || CAFE_MEALISH_TAGS.test(h);
    if (!cafeOk) return true;
  }

  if (/(?:성인|미성년)\s*전용|(?:19|십구)\s*세\s*이상|미성년자\s*입장\s*불가/.test(h)) return true;
  return false;
}

/**
 * 코스 빔 탐색: family_kids 에서 CAFE 는 앞 단계는 light_meal·키즈 신호 위주,
 * drink_only 는 2번째(인덱스 1) 이후 CAFE 단계에서만 허용.
 */
export function familyKidsBeamStepRejects(
  card: HomeCard,
  stepType: PlaceType,
  stepIndex: number,
  obj: ScenarioObject
): boolean {
  if (obj.scenario !== "family_kids" && obj.scenario !== "parent_child_outing") return false;
  const prof = computeFamilyPlaceProfile(card);
  const q = String(obj.rawQuery ?? "").toLowerCase();
  const allowParent = parentGatheringOrRestorativeQuery(q);

  if (prof.alcohol_focused) return true;

  if (stepType === "FOOD" && (prof.mealRisk === "high" || prof.familySuitability === "risky_for_kids")) {
    const fh = fullHay(card);
    const fishStew = isFamilyKidsFishStewRiskHaystack(fh);
    const fishMitigated = fishStew && familyKidsFishRiskMitigationTagsPresent(card);
    if (!fishMitigated && !allowParent) return true;
  }

  if (stepType === "CAFE") {
    if (prof.servingType === "drink_only" && stepIndex < 1) return true;
    if (stepIndex < 1) {
      const h = fullHay(card);
      const earlyCafeOk =
        prof.servingType === "light_meal" ||
        CAFE_MEALISH_TAGS.test(h);
      if (!earlyCafeOk) return true;
    }
  }

  return false;
}
