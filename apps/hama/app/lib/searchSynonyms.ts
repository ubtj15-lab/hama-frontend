/**
 * 음식·메뉴 검색어 확장 사전 — Supabase 검색 전 query 확장용.
 * 키(사용자 입력) → 동의어·관련 메뉴명 배열.
 */
export const SEARCH_SYNONYM_GROUPS: Record<string, readonly string[]> = {
  고기: [
    "고기",
    "고기집",
    "고깃집",
    "삼겹살",
    "대패삼겹살",
    "통삼겹",
    "목살",
    "돼지고기",
    "소고기",
    "갈비",
    "돼지갈비",
    "소갈비",
    "우대갈비",
    "숯불구이",
    "구이전문",
  ],
  중식: [
    "중식",
    "중국집",
    "짬뽕",
    "해물짬뽕",
    "삼선짬뽕",
    "짜장면",
    "짜장",
    "간짜장",
    "탕수육",
    "볶음밥",
    "마라탕",
  ],
  분식: ["분식", "김밥", "꼬마김밥", "떡볶이", "순대", "라면", "튀김"],
  파스타: ["파스타", "봉골레파스타", "투움바파스타", "크림파스타", "빠네파스타", "매콤파스타"],
  칼국수: ["칼국수", "손칼국수", "백합칼국수", "홍두깨칼국수"],
  코다리: ["코다리", "코다리찜", "코다리냉면", "명태조림"],
  냉면: ["냉면", "물냉면", "비빔냉면", "코다리냉면"],
  돈까스: ["돈까스", "돈가스", "경양식돈까스", "수제돈까스", "소인돈까스", "돈까스집", "돈가스집"],
  국밥: ["국밥", "돼지국밥", "장터국밥", "순대국", "순댓국"],
  브런치: ["브런치", "브런치카페"],
  초밥: ["초밥", "스시", "회전초밥"],
  디저트: ["디저트", "케이크", "케익", "마카롱", "달달", "베이커리", "소금빵", "빵집"],
  해장: ["해장", "해장국", "숙취", "해장할"],
  키즈카페: ["키즈카페", "키즈 카페", "놀이카페", "키즈룸"],
  치킨: ["치킨", "치킨집", "후라이드", "양념치킨"],
  떡볶이: ["떡볶이", "분식"],
  라멘: ["라멘", "라멘집", "돈코츠", "츠케멘"],
  소금빵: ["소금빵", "베이커리", "빵집"],
} as const;

function normalizeQueryKey(query: string): string {
  return String(query ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

/** 짧은 일반어는 부분일치에서 제외 (과매칭 방지) */
const SUBSTRING_BLOCKLIST = new Set(["밥", "집", "곳", "데"]);

function phraseHitsQuery(compactQ: string, spacedQ: string, phrase: string): boolean {
  const p = String(phrase ?? "").trim().toLowerCase();
  if (p.length < 2 || SUBSTRING_BLOCKLIST.has(p)) return false;
  if (spacedQ.includes(p)) return true;
  const pc = p.replace(/\s+/g, "");
  return pc.length >= 2 && compactQ.includes(pc);
}

/**
 * 문장 안에 동의어 그룹 키가 들어있는 그룹을 모두 찾는다 (exact key equality 아님).
 */
export function matchSynonymGroupsInQuery(query: string): string[] {
  const raw = String(query ?? "").trim();
  if (!raw) return [];
  const compactQ = normalizeQueryKey(raw);
  const spacedQ = raw.toLowerCase();
  const out = new Set<string>();

  for (const [key, terms] of Object.entries(SEARCH_SYNONYM_GROUPS)) {
    const keyHit = phraseHitsQuery(compactQ, spacedQ, key);
    const termHit = terms.some((t) => phraseHitsQuery(compactQ, spacedQ, t));
    if (!keyHit && !termHit) continue;
    out.add(key);
    for (const t of terms) {
      const s = String(t).trim();
      if (s) out.add(s);
    }
  }
  return [...out];
}

/**
 * 사용자 검색어를 동의어·관련 메뉴명 목록으로 확장한다.
 * 원문 exact 매칭 + 문장 부분 일치 그룹 확장.
 */
export function expandSearchQuery(query: string): string[] {
  const raw = String(query ?? "").trim();
  if (!raw) return [];

  const out = new Set<string>();
  out.add(raw);

  const key = normalizeQueryKey(raw);
  const group = SEARCH_SYNONYM_GROUPS[key];
  if (group) {
    for (const term of group) {
      const t = String(term).trim();
      if (t) out.add(t);
    }
  }

  for (const t of matchSynonymGroupsInQuery(raw)) {
    out.add(t);
  }

  return [...out];
}
