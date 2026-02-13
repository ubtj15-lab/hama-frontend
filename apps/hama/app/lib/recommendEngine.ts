// app/lib/recommendEngine.ts

import type { HomeCard } from "@/lib/storeTypes";

export type Preference = {
  // 사용자가 아이/가족을 언급했는지
  withKids?: boolean;
  // 업무/노트북/미팅 등 언급했는지
  forWork?: boolean;
  // 예약/웨이팅 등 언급했는지
  reservationRequired?: boolean;

  // 카테고리 힌트(있으면 정렬에 가중치)
  categoryHint?: HomeCard["category"] | null;

  // 키워드 힌트(태그/무드에 매칭)
  keywords?: string[];
};

/**
 * 아주 단순한 규칙 기반 선호도 추론
 * (오베용: 안전하게 "추론 실패"하면 undefined 반환 가능)
 */
export function inferPreferenceFromText(text: string): Preference | undefined {
  const t = (text ?? "").toLowerCase().trim();
  if (!t) return undefined;

  const pref: Preference = {};

  // 아이/가족
  if (
    t.includes("아이") ||
    t.includes("키즈") ||
    t.includes("가족") ||
    t.includes("유아") ||
    t.includes("아기")
  ) {
    pref.withKids = true;
    pref.keywords = [...(pref.keywords ?? []), "아이동반", "가족"];
  }

  // 업무/노트북/미팅
  if (
    t.includes("노트북") ||
    t.includes("업무") ||
    t.includes("회의") ||
    t.includes("미팅") ||
    t.includes("작업") ||
    t.includes("공부")
  ) {
    pref.forWork = true;
    pref.keywords = [...(pref.keywords ?? []), "업무", "조용함"];
  }

  // 예약/웨이팅
  if (t.includes("예약") || t.includes("웨이팅") || t.includes("대기")) {
    pref.reservationRequired = true;
    pref.keywords = [...(pref.keywords ?? []), "예약필수"];
  }

  // 카테고리 힌트
  if (t.includes("카페") || t.includes("커피") || t.includes("디저트")) pref.categoryHint = "cafe";
  if (t.includes("식당") || t.includes("맛집") || t.includes("밥") || t.includes("점심") || t.includes("저녁"))
    pref.categoryHint = "restaurant";
  if (t.includes("미용") || t.includes("헤어") || t.includes("네일") || t.includes("피부")) pref.categoryHint = "salon";
  if (t.includes("놀거리") || t.includes("데이트") || t.includes("체험") || t.includes("전시") || t.includes("액티비티"))
    pref.categoryHint = "activity";

  return pref;
}

/**
 * 선호도 기반으로 store(HomeCard)를 정렬
 * - 절대 필드명: with_kids / for_work / reservation_required 를 사용
 */
export function rankStoresByPreference(stores: HomeCard[], pref: Preference): HomeCard[] {
  const list = Array.isArray(stores) ? [...stores] : [];
  if (!pref) return list;

  const kw = (pref.keywords ?? []).map((x) => String(x).toLowerCase());

  function score(card: HomeCard): number {
    let s = 0;

    // 카테고리 힌트
    if (pref.categoryHint && card.category === pref.categoryHint) s += 5;

    // 아이/가족 (✅ 여기서 withKids -> with_kids 로 고침)
    if (pref.withKids) {
      if ((card as any).with_kids) s += 3;
      else s -= 1;
    }

    // 업무 (✅ for_work)
    if (pref.forWork) {
      if ((card as any).for_work) s += 2;
      else s -= 1;
    }

    // 예약 (✅ reservation_required)
    if (pref.reservationRequired) {
      if ((card as any).reservation_required) s += 2;
    }

    // tags/mood 키워드 매칭 (있으면 가산)
    const tags = Array.isArray((card as any).tags) ? ((card as any).tags as string[]) : [];
    const mood = Array.isArray((card as any).mood) ? ((card as any).mood as string[]) : [];

    const hay = [...tags, ...mood]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase());

    for (const k of kw) {
      if (hay.some((h) => h.includes(k))) s += 1;
    }

    return s;
  }

  list.sort((a, b) => score(b) - score(a));
  return list;
}
