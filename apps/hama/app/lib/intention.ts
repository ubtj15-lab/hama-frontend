// /app/lib/intention.ts

export type IntentionType = "date" | "solo" | "family" | "meeting" | "none";

const DATE_KEYWORDS = [
  "데이트",
  "커플",
  "여자친구",
  "남자친구",
  "기념일",
  "소개팅",
  "분위기",
  "로맨틱",
  "둘이",
  "조용한",
];

const SOLO_KEYWORDS = [
  "혼밥",
  "혼자",
  "간단히",
  "빨리",
  "빠르게",
  "가볍게",
  "점심",
  "저녁",
  "혼술",
];

const FAMILY_KEYWORDS = [
  "가족",
  "아이",
  "애기",
  "부모님",
  "어린이",
  "유아",
  "키즈",
  "할머니",
  "할아버지",
];

const MEETING_KEYWORDS = [
  "회식",
  "모임",
  "단체",
  "술",
  "한잔",
  "뒤풀이",
  "2차",
  "3차",
  "친구들이랑",
];

type KeywordMap = Record<Exclude<IntentionType, "none">, string[]>;

const KEYWORDS: KeywordMap = {
  date: DATE_KEYWORDS,
  solo: SOLO_KEYWORDS,
  family: FAMILY_KEYWORDS,
  meeting: MEETING_KEYWORDS,
};

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 사용자 입력(query)에서 의도 1개를 판별한다.
 * - 가장 많이 매칭된 의도를 선택
 * - 동점이면 우선순위로 결정 (date > solo > family > meeting)
 * - 매칭이 없으면 "none"
 */
export function inferIntention(query: string): IntentionType {
  const q = normalizeText(query);
  if (!q) return "none";

  const counts: Record<Exclude<IntentionType, "none">, number> = {
    date: 0,
    solo: 0,
    family: 0,
    meeting: 0,
  };

  (Object.keys(KEYWORDS) as Array<Exclude<IntentionType, "none">>).forEach(
    (intent) => {
      for (const kw of KEYWORDS[intent]) {
        if (q.includes(kw)) counts[intent] += 1;
      }
    }
  );

  const max = Math.max(...Object.values(counts));
  if (max === 0) return "none";

  const candidates = (Object.entries(counts) as Array<
    [Exclude<IntentionType, "none">, number]
  >)
    .filter(([, c]) => c === max)
    .map(([intent]) => intent);

  // 동점일 때는 "제품 전략상" 우선순위로 결정
  const priority: Array<Exclude<IntentionType, "none">> = [
    "date",
    "solo",
    "family",
    "meeting",
  ];

  for (const p of priority) {
    if (candidates.includes(p)) return p;
  }

  return candidates[0] ?? "none";
}
