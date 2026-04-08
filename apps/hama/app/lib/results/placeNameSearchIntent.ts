/**
 * 결과/검색 URL 쿼리가 "특정 매장 이름 찾기"에 가까우면
 * 시나리오 추천보다 places 매장명 검색을 먼저 수행한다.
 */

/** 추천·상황·카테고리 탐색 힌트가 있으면 매장명 우선 검색 안 함 */
const NOT_BRAND_QUERY = new RegExp(
  [
    "추천",
    "코스",
    "일정",
    "나들이",
    "먹지",
    "먹을",
    "점심",
    "저녁",
    "아침",
    "브런치",
    "야식",
    "데이트",
    "혼밥",
    "맛집",
    "식당",
    "밥",
    "술",
    "카페",
    "커피",
    "디저트",
    "미용",
    "머리",
    "헤어",
    "네일",
    "놀거리",
    "액티",
    "체험",
    "가족",
    "아이랑",
    "아이와",
    "키즈",
    "부모님",
    "어른",
    "근처",
    "주변",
    "周辺",
    "어디",
    "무엇",
    "뭐",
    "메추",
    "점메추",
    "저메추",
    "골라",
    "짜줘",
    "알려",
    "찾아",
    "검색",
    "추천해",
    "할까",
    "\\?",
  ].join("|"),
  "i"
);

function countHangulSyllables(s: string): number {
  return (s.match(/[\uac00-\ud7a3]/g) ?? []).length;
}

export function normalizeBrandQuery(raw: string): string {
  return String(raw ?? "")
    .replace(/[㈜㈠()[\]【】]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 공백 제거 비교용
 */
export function compactQuery(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

const MAX_HANGUL_BRAND = 24;
/** 지점명·혼합 상호 등 (예: 맥도날드 오산DT점) — 상한만 둠 */
const MAX_BRAND_CHARS = 48;

export type PlaceNameSearchGate = {
  enabled: boolean;
  reason:
    | "store_like_query"
    | "too_short"
    | "too_long"
    | "context_keyword"
    | "not_store_shape"
    | "empty";
};

/**
 * 매장명 우선 검색 여부(게이트) — 개발 로그·테스트용 설명 포함
 */
export function explainPlaceNameSearchGate(q: string): PlaceNameSearchGate {
  const raw = String(q ?? "").trim();
  if (!raw) return { enabled: false, reason: "empty" };
  const t = normalizeBrandQuery(raw);
  if (t.length < 2) return { enabled: false, reason: "too_short" };
  if (t.length > MAX_BRAND_CHARS) return { enabled: false, reason: "too_long" };
  if (NOT_BRAND_QUERY.test(t)) return { enabled: false, reason: "context_keyword" };

  const hangul = countHangulSyllables(t);

  if (/^[a-zA-Z0-9·.\s'-]{2,32}$/.test(t)) return { enabled: true, reason: "store_like_query" };

  if (hangul >= 2 && hangul <= MAX_HANGUL_BRAND) {
    const weird = t.replace(/[\uac00-\ud7a3a-zA-Z0-9·.\s\-'&]/g, "").length;
    if (weird <= 1) return { enabled: true, reason: "store_like_query" };
  }

  return { enabled: false, reason: "not_store_shape" };
}

/**
 * 매장명 우선 검색 여부.
 * - 한글 2~24음절 전후의 짧은 상호·브랜드 (+영숫자·지점 혼합)
 * - 의도·카테고리 키워드 없음
 */
export function shouldRunPlaceNameSearchFirst(q: string): boolean {
  return explainPlaceNameSearchGate(q).enabled;
}
