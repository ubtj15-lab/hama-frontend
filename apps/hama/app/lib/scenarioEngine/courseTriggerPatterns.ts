import { normIntentQuery } from "./intentQueryNormalize";

/** 명시적 '코스·일정·동선' 요청 (legacy course_generation 트리거) */
export const COURSE_TRIGGER_RULES: { id: string; re: RegExp }[] = [
  { id: "phrase:데이트코스", re: /데이트\s*코스/ },
  { id: "phrase:반나절코스", re: /반나절\s*코스/ },
  { id: "phrase:상황+코스", re: /(하루|오전|오후|나들이|키즈|가족|식사|브런치|워크샵)\s*코스/ },
  { id: "phrase:코스짜기", re: /코스\s*(짜|이어|구성|만들|추천|잡아)/ },
  { id: "phrase:추천코스", re: /추천\s*코스/ },
  { id: "phrase:코스로바꿔", re: /코스로\s*바꿔/ },
  { id: "phrase:일정짜기", re: /일정\s*(짜|세우|잡아|추천|잡을)/ },
  { id: "phrase:아이일정", re: /(아이랑|키즈|가족|애\s*데리고|부모님)\s*일정/ },
  { id: "phrase:데이트일정", re: /데이트\s*일정/ },
  { id: "phrase:몇시어디", re: /몇\s*시에\s*어디|몇시에\s*어디/ },
  { id: "phrase:순서", re: /순서대로|순서\s*짜/ },
  { id: "phrase:루트", re: /(동선|이동)?\s*루트|루트\s*(짜|추천|잡)/ },
  { id: "phrase:플랜", re: /플랜|플래?랜/ },
  { id: "phrase:시간표", re: /시간표/ },
];

export function explainCourseGenerationMatch(q: string): { matched: boolean; ruleId?: string } {
  const n = normIntentQuery(q);
  if (!n) return { matched: false };
  for (const { id, re } of COURSE_TRIGGER_RULES) {
    if (re.test(n)) return { matched: true, ruleId: id };
  }
  return { matched: false };
}

export function isCourseGenerationQuery(q: string): boolean {
  return explainCourseGenerationMatch(q).matched;
}
