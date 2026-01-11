// lib/recommendEngine.ts

import type { HomeCard } from "./storeTypes";

// 1) 사용자의 문장에서 preference 뽑기
export function inferPreferenceFromText(text: string) {
  const t = text.toLowerCase();

  const pref = {
    withKids: false,
    forWork: false,
    priceLevel: 0,
    category: "",
    tags: [] as string[],
  };

  // =========================
  // 🔥 아이랑 / 아이와 / 키즈 / 가족
  // =========================
  if (
    t.includes("아이랑") ||
    t.includes("아이와") ||
    t.includes("아이") && t.includes("가기") ||
    t.includes("키즈") ||
    t.includes("가족") ||
    t.includes("애기")
  ) {
    pref.withKids = true;
  }

  // =========================
  // 🔥 작업 / 공부 / 조용 / 노트북
  // =========================
  if (
    t.includes("작업") ||
    t.includes("공부") ||
    t.includes("조용") ||
    t.includes("노트북") ||
    t.includes("일하기")
  ) {
    pref.forWork = true;
  }

  // =========================
  // 🔥 카테고리
  // =========================
  if (t.includes("카페")) pref.category = "카페";
  if (t.includes("식당") || t.includes("밥집")) pref.category = "식당";
  if (t.includes("브런치")) pref.tags.push("브런치");

  return pref;
}

// 2) 점수 계산
export function rankStoresByPreference(pref: any, stores: HomeCard[]) {
  return stores
    .map((s) => {
      let score = 0;

      if (pref.withKids && s.withKids) score += 40;
      if (pref.forWork && s.forWork) score += 40;
      if (pref.category && s.categoryLabel.includes(pref.category))
        score += 20;

      pref.tags.forEach((tag: string) => {
        if (s.tags?.includes(tag)) score += 10;
      });

      return { ...s, score };
    })
    .sort((a, b) => b.score - a.score);
}
