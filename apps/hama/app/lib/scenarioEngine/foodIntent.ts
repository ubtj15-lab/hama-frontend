import type { FoodSubCategory, ScenarioObject } from "./types";

function normQ(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** strict 카테고리 보너스용 — {@link detectFoodSubCategory} 규칙과 동기화 */
export const FOOD_SUB_RULES: { sub: FoodSubCategory; hints: string[] }[] = [
  {
    sub: "CHINESE",
    hints: ["중국집", "중국", "중식", "짜장", "짬뽕", "탕수육", "마라", "훠궈"],
  },
  {
    sub: "JAPANESE",
    hints: ["일본", "일식", "초밥", "스시", "돈까스", "라멘", "우동"],
  },
  {
    sub: "KOREAN",
    hints: ["한식", "국밥", "찌개", "김치찌개", "된장찌개", "비빔밥", "백반", "냉면"],
  },
  {
    sub: "WESTERN",
    hints: ["양식", "파스타", "스테이크", "피자", "리조또", "브런치"],
  },
  {
    sub: "FASTFOOD",
    hints: ["햄버거", "맥도날드", "버거킹", "롯데리아", "샌드위치"],
  },
];

const FOOD_SUB_TIE_PRIORITY: FoodSubCategory[] = [
  "CHINESE",
  "JAPANESE",
  "KOREAN",
  "WESTERN",
  "FASTFOOD",
];

/**
 * 패턴 → 정규 메뉴명. 긴 문자열을 먼저 매칭하도록 선언 순서 유지(detectMenuIntent에서 정렬).
 */
const MENU_PATTERN_ROWS: { pattern: string; menu: string }[] = [
  { pattern: "김치찌개", menu: "김치찌개" },
  { pattern: "된장찌개", menu: "된장찌개" },
  { pattern: "마라탕", menu: "마라탕" },
  { pattern: "마라샹궈", menu: "마라샹궈" },
  { pattern: "탕수육", menu: "탕수육" },
  { pattern: "짜장면", menu: "짜장면" },
  { pattern: "짬뽕", menu: "짬뽕" },
  { pattern: "비빔밥", menu: "비빔밥" },
  { pattern: "돈까스", menu: "돈까스" },
  { pattern: "스테이크", menu: "스테이크" },
  { pattern: "샌드위치", menu: "샌드위치" },
  { pattern: "햄버거", menu: "햄버거" },
  { pattern: "버거킹", menu: "햄버거" },
  { pattern: "맥도날드", menu: "햄버거" },
  { pattern: "롯데리아", menu: "햄버거" },
  { pattern: "리조또", menu: "리조또" },
  { pattern: "파스타", menu: "파스타" },
  { pattern: "브런치", menu: "브런치" },
  { pattern: "국밥집", menu: "국밥" },
  { pattern: "초밥", menu: "초밥" },
  { pattern: "스시", menu: "초밥" },
  { pattern: "라멘", menu: "라멘" },
  { pattern: "우동", menu: "우동" },
  { pattern: "냉면", menu: "냉면" },
  { pattern: "백반", menu: "백반" },
  { pattern: "피자", menu: "피자" },
  { pattern: "훠궈", menu: "훠궈" },
  { pattern: "짜장", menu: "짜장면" },
  { pattern: "국밥", menu: "국밥" },
  { pattern: "마라", menu: "마라탕" },
];

const MENU_PATTERNS_SORTED = [...MENU_PATTERN_ROWS].sort((a, b) => b.pattern.length - a.pattern.length);

function countSubHits(q: string, hints: string[]): number {
  let n = 0;
  for (const h of hints) {
    if (q.includes(h)) n += 1;
  }
  return n;
}

export function hasAnyFoodSubKeyword(rawQuery: string): boolean {
  const q = normQ(rawQuery);
  if (!q) return false;
  for (const { hints } of FOOD_SUB_RULES) {
    for (const h of hints) {
      if (q.includes(h)) return true;
    }
  }
  return false;
}

export function detectFoodSubCategory(rawQuery: string): FoodSubCategory | null {
  const q = normQ(rawQuery);
  if (!q) return null;

  const scores: Partial<Record<FoodSubCategory, number>> = {};
  for (const { sub, hints } of FOOD_SUB_RULES) {
    const n = countSubHits(q, hints);
    if (n > 0) scores[sub] = n;
  }

  const entries = Object.entries(scores) as [FoodSubCategory, number][];
  if (!entries.length) return null;

  const max = Math.max(...entries.map(([, s]) => s));
  const ties = entries.filter(([, s]) => s === max).map(([k]) => k);
  if (ties.length === 1) return ties[0]!;

  for (const p of FOOD_SUB_TIE_PRIORITY) {
    if (ties.includes(p)) return p;
  }
  return ties[0] ?? null;
}

/**
 * 쿼리에서 메뉴 의도(정규 메뉴명) 추출. 긴 패턴 우선, 중복 메뉴명 제거.
 */
export function detectMenuIntent(rawQuery: string): string[] {
  const q = normQ(rawQuery);
  if (!q) return [];

  const menus = new Set<string>();
  let masked = q;

  for (const { pattern, menu } of MENU_PATTERNS_SORTED) {
    if (!pattern || !masked.includes(pattern)) continue;
    menus.add(menu);
    masked = masked.split(pattern).join(" ");
  }

  return [...menus];
}

const SUB_DISPLAY: Record<FoodSubCategory, string> = {
  CHINESE: "중식",
  JAPANESE: "일식",
  KOREAN: "한식",
  WESTERN: "양식",
  FASTFOOD: "패스트푸드",
};

/**
 * 추천 카드 pill 옆에 붙일 음식 맥락 태그(짧은 한국어 라벨).
 */
const MENU_TO_SUB: { menu: string; sub: FoodSubCategory }[] = [
  { menu: "짜장면", sub: "CHINESE" },
  { menu: "짬뽕", sub: "CHINESE" },
  { menu: "탕수육", sub: "CHINESE" },
  { menu: "마라탕", sub: "CHINESE" },
  { menu: "마라샹궈", sub: "CHINESE" },
  { menu: "훠궈", sub: "CHINESE" },
  { menu: "초밥", sub: "JAPANESE" },
  { menu: "돈까스", sub: "JAPANESE" },
  { menu: "라멘", sub: "JAPANESE" },
  { menu: "우동", sub: "JAPANESE" },
  { menu: "국밥", sub: "KOREAN" },
  { menu: "김치찌개", sub: "KOREAN" },
  { menu: "된장찌개", sub: "KOREAN" },
  { menu: "비빔밥", sub: "KOREAN" },
  { menu: "냉면", sub: "KOREAN" },
  { menu: "백반", sub: "KOREAN" },
  { menu: "파스타", sub: "WESTERN" },
  { menu: "스테이크", sub: "WESTERN" },
  { menu: "피자", sub: "WESTERN" },
  { menu: "리조또", sub: "WESTERN" },
  { menu: "브런치", sub: "WESTERN" },
  { menu: "햄버거", sub: "FASTFOOD" },
  { menu: "샌드위치", sub: "FASTFOOD" },
];

/** 메뉴명만 있을 때 foodSubCategory 보강 */
export function inferFoodSubFromMenus(menus: string[]): FoodSubCategory | null {
  if (!menus.length) return null;
  for (const m of menus) {
    const hit = MENU_TO_SUB.find((row) => row.menu === m);
    if (hit) return hit.sub;
  }
  return null;
}

export function buildFoodTagsForCard(
  parsed: Pick<ScenarioObject, "foodSubCategory" | "menuIntent">
): string[] {
  const tags: string[] = [];
  const sub = parsed.foodSubCategory;
  const menus = [...(parsed.menuIntent ?? [])].sort();

  if (sub) tags.push(SUB_DISPLAY[sub]);

  const hasJajeon = menus.includes("짜장면");
  const hasJjambbong = menus.includes("짬뽕");
  if (hasJajeon && hasJjambbong) tags.push("짜장/짬뽕");
  else {
    if (hasJajeon) tags.push("짜장면");
    if (hasJjambbong) tags.push("짬뽕");
  }

  for (const m of menus) {
    if (m === "짜장면" || m === "짬뽕") continue;
    if (m === "탕수육") tags.push("탕수육 가능");
    else if (!tags.includes(m)) tags.push(m);
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const t of tags) {
    const k = t.replace(/\s+/g, "").toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    deduped.push(t);
  }

  return deduped.slice(0, 5);
}
