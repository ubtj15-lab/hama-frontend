/**
 * 추천 카드 badge — 요청 시나리오 우선, 상충 라벨 억제, 최대 3개.
 * 매장 raw tags를 그대로 붙이지 않고 시나리오·근거 점수로 선별한다.
 */
import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendScenarioKey } from "@/lib/recommend/scenarioWeights";
import type { ServingTypeForCopy } from "@/lib/recommend/recommendationCopy";

export type SelectRecommendationBadgesInput = {
  scenario: RecommendScenarioKey | undefined;
  serving: ServingTypeForCopy;
  card: HomeCard;
  /** blob(card) 소문자·공백 정규화 문자열 */
  blob: string;
  distanceKm: number | null | undefined;
  childFriendlyScore: number;
  /** 0~1 — 데이트 톤 텍스트 근거 */
  dateFriendlyScore: number;
  /** 0~1 — 혼행·혼밥 톤 텍스트 근거 */
  soloFriendlyScore: number;
  max?: number;
};

/** 시나리오별 우선 순서(앞이 먼저) */
export const SCENARIO_BADGE_PRIORITY: Record<RecommendScenarioKey, string[]> = {
  solo: [
    "혼밥가능",
    "가성비",
    "빠른식사",
    "조용함",
    "부담없음",
    "가까움",
    "카운터좌석",
    "짧게머물기좋음",
  ],
  date: [
    "데이트",
    "분위기",
    "감성",
    "조용함",
    "야외",
    "브런치",
    "디저트",
    "산책연계",
    "사진분위기",
  ],
  family: [
    "주차가능",
    "대기부담적음",
    "메뉴선택쉬움",
    "좌석넉넉",
    "유모차가능",
    "키즈존",
    "가족외식",
    "아이동반",
  ],
  group: ["단체가능", "모임", "회식", "좌석넉넉", "이야기하기좋음"],
};

/** 메인 3칸에서 제외(시나리오별 상충) */
export const SCENARIO_BADGE_FORBIDDEN: Record<RecommendScenarioKey, Set<string>> = {
  solo: new Set(["아이동반", "데이트", "가족외식", "가족·아이", "키즈존"]),
  date: new Set(["아이동반", "혼밥가능", "가족외식", "가족·아이"]),
  family: new Set(["혼밥가능", "데이트"]),
  group: new Set(["혼밥가능", "데이트"]),
};

type EvidenceRule = { re: RegExp; weight: number };

const BADGE_EVIDENCE: Record<string, EvidenceRule[]> = {
  혼밥가능: [
    { re: /혼밥|1인|나혼자|혼자\s*식사|1인석/, weight: 1 },
    { re: /카운터|바좌석/, weight: 0.7 },
  ],
  가성비: [{ re: /가성비|저렴|착한\s*가격|합리적/, weight: 1 }],
  빠른식사: [
    { re: /빠른|간단|백반|분식|도시락|스피드|회전\s*빠|즉석/, weight: 1 },
    { re: /한\s*끼|점심|저녁/, weight: 0.4 },
  ],
  조용함: [{ re: /조용|한적|차분|잔잔/, weight: 1 }],
  부담없음: [{ re: /부담\s*없|무난|편안|가벼운/, weight: 1 }],
  가까움: [{ re: /역\s*앞|도보|접근|가까운|근처/, weight: 0.8 }],
  카운터좌석: [{ re: /카운터|바좌석|싱글\s*석/, weight: 1 }],
  짧게머물기좋음: [{ re: /잠깐|짧게|가볍게|테이크아웃/, weight: 1 }],
  데이트: [{ re: /데이트|커플|연인|로맨틱/, weight: 1 }],
  분위기: [{ re: /분위기|인테리어|감각|예쁜/, weight: 1 }],
  감성: [{ re: /감성|감각적|무드/, weight: 1 }],
  야외: [{ re: /야외|테라스|루프탑|정원/, weight: 1 }],
  브런치: [{ re: /브런치|브런치/, weight: 1 }],
  디저트: [{ re: /디저트|케이크|베이커리|마카롱/, weight: 1 }],
  산책연계: [{ re: /산책|공원|호수|강변|둘레/, weight: 1 }],
  사진분위기: [{ re: /사진|인생샷|포토|인스타/, weight: 1 }],
  아이동반: [{ re: /아이동반|키즈|유아|어린이|가족\s*단위/, weight: 1 }],
  가족외식: [{ re: /가족|가족식|가족\s*모임|키즈\s*환영/, weight: 0.9 }],
  주차가능: [{ re: /주차|발렛|parking/i, weight: 1 }],
  좌석넉넉: [{ re: /좌석.{0,4}넓|넓은\s*좌석|가족석|룸|테이블\s*넓/, weight: 1 }],
  유모차가능: [{ re: /유모차|엘리베이터|휠체어/, weight: 0.9 }],
  키즈존: [{ re: /키즈존|키즈룸|놀이방/, weight: 1 }],
  대기부담적음: [{ re: /웨이팅\s*적|대기\s*적|바로\s*입장|대기\s*줄/, weight: 1 }],
  메뉴선택쉬움: [{ re: /메뉴.{0,6}다양|코스|뷔페|선택/, weight: 0.7 }],
  단체가능: [{ re: /단체|다인석|대형\s*룸/, weight: 1 }],
  모임: [{ re: /모임|단체모임|소모임/, weight: 0.9 }],
  회식: [{ re: /회식|야유회|워크샵/, weight: 1 }],
  이야기하기좋음: [{ re: /대화|담소|수다|담소/, weight: 0.8 }],
};

function evidenceForLabel(label: string, blob: string): number {
  const rules = BADGE_EVIDENCE[label];
  if (!rules?.length) return 0;
  let max = 0;
  for (const { re, weight } of rules) {
    if (re.test(blob)) max = Math.max(max, weight);
  }
  return max;
}

/** blob 기반 데이트 적합도 0~1 — 가족·키즈 톤이 강하면 감점 */
export function computeDateFriendlyScore(blob: string): number {
  const familyClash = /(?:가족\s*외식|키즈|아이\s*동반|유아|어린이\s*메뉴|가족\s*단위|유모차)/.test(blob);
  let base = 0;
  const hits = [
    /데이트|로맨틱|커플|분위기|감성|야경|브런치|디저트|대화|야외|인스타|포토/,
  ].filter((re) => re.test(blob)).length;
  base = Math.min(1, hits * 0.35 + (/데이트|분위기|감성/.test(blob) ? 0.4 : 0));
  if (familyClash) base = Math.max(0, base - 0.38);
  return base;
}

/** blob 기반 혼행·혼밥 적합도 0~1 */
export function computeSoloFriendlyScore(blob: string): number {
  let s = 0;
  if (/혼밥|1인|나혼자|혼자|카운터/.test(blob)) s += 0.55;
  if (/가성비|간단|빠른|백반|분식/.test(blob)) s += 0.35;
  return Math.min(1, s);
}

function distanceEvidence(km: number | null | undefined): number {
  if (km == null || !Number.isFinite(km)) return 0;
  if (km <= 0.8) return 1;
  if (km <= 1.5) return 0.75;
  if (km <= 2.5) return 0.45;
  return 0;
}

function scoreCandidate(
  label: string,
  orderIndex: number,
  orderLen: number,
  input: SelectRecommendationBadgesInput
): number {
  const ev = evidenceForLabel(label, input.blob);
  let bonus = 0;
  if (label === "가까움") bonus = distanceEvidence(input.distanceKm);
  if (label === "아이동반" || label === "가족외식" || label === "키즈존") {
    bonus += input.childFriendlyScore * 0.35;
  }
  if (label === "데이트" || label === "분위기" || label === "감성") {
    let d = input.dateFriendlyScore * 0.25;
    if (input.scenario === "date" && /(?:가족|키즈|아이\s*동반|유아)/.test(input.blob)) d *= 0.35;
    bonus += d;
  }
  if (label === "혼밥가능" || label === "빠른식사" || label === "카운터좌석") {
    bonus += input.soloFriendlyScore * 0.25;
  }

  /** 요청 시나리오가 있으면 우선순위 인덱스로 큰 가중(텍스트 약해도 상위권 유지) */
  const scenarioOrderBoost = input.scenario ? (orderLen - orderIndex) * 8 : 0;
  const anchor = input.scenario ? 2 : 0;

  return scenarioOrderBoost + anchor + ev * 6 + bonus * 4;
}

function neutralBadges(blob: string, card: HomeCard, max: number): string[] {
  const out: string[] = [];
  const cat = String(card.category ?? "").toLowerCase();
  if (cat === "cafe") out.push("카페");
  else if (cat === "restaurant") out.push("식사");
  else if (cat === "activity") out.push("놀거리");
  else if (cat === "salon") out.push("미용");
  if (out.length < max && /주차|발렛|parking/i.test(blob)) out.push("주차가능");
  if (out.length < max && /조용|한적/.test(blob)) out.push("조용함");
  if (out.length < max && /가성비|저렴/.test(blob)) out.push("가성비");
  if (out.length < max && /혼밥|1인/.test(blob)) out.push("혼밥가능");
  return out.slice(0, max);
}

export function selectRecommendationBadges(input: SelectRecommendationBadgesInput): string[] {
  const max = input.max ?? 3;
  const { scenario, serving, blob, card } = input;

  if (!scenario) {
    const n = neutralBadges(blob, card, max);
    return n.length ? n : ["추천"];
  }

  const forbidden = SCENARIO_BADGE_FORBIDDEN[scenario];
  const priority = SCENARIO_BADGE_PRIORITY[scenario];
  const orderLen = priority.length;

  type Scored = { label: string; score: number; idx: number };
  const scored: Scored[] = [];

  for (let i = 0; i < priority.length; i++) {
    const label = priority[i]!;
    if (forbidden.has(label)) continue;

    /** drink-only(카페 등): 식사형 배지는 제외 — 혼밥 의도(solo)는 혼밥가능·가성비 유지 */
    if (serving === "drink") {
      if (label === "빠른식사") continue;
      if (label === "브런치" && !/브런치/.test(blob)) continue;
    }

    const idx = i;
    const s = scoreCandidate(label, idx, orderLen, input);
    scored.push({ label, score: s, idx });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });

  const out: string[] = [];
  for (const { label } of scored) {
    if (out.includes(label)) continue;
    /** 최소 근거: 시나리오 상위권은 점수 0 이상이면 허용, 아니면 evidence 또는 거리·점수 보조가 있을 때만 */
    const ev = evidenceForLabel(label, blob);
    const minBar =
      scenario === "solo" && ["혼밥가능", "가성비", "빠른식사"].includes(label)
        ? -1
        : scenario === "date" && ["데이트", "분위기", "감성"].includes(label)
          ? -1
          : scenario === "family" && ["아이동반", "가족외식"].includes(label)
            ? -1
            : scenario === "group" && ["단체가능", "모임", "회식"].includes(label)
              ? -1
              : 0.01;

    const pass =
      minBar < 0 ||
      ev >= 0.01 ||
      (label === "가까움" && distanceEvidence(input.distanceKm) > 0) ||
      (label === "조용함" && /조용|한적/.test(blob));

    if (!pass) continue;

    out.push(label);
    if (out.length >= max) break;
  }

  if (out.length < max) {
    for (const { label } of scored) {
      if (out.includes(label)) continue;
      if (out.length >= max) break;
      if (forbidden.has(label)) continue;
      if (serving === "drink" && label === "빠른식사") continue;
      out.push(label);
      if (out.length >= max) break;
    }
  }

  if (out.length === 0) {
    return scenario === "solo"
      ? ["혼밥가능", "가성비", "빠른식사"].slice(0, max)
      : scenario === "date"
        ? ["데이트", "분위기", "조용함"].slice(0, max)
        : scenario === "family"
          ? ["주차가능", "대기부담적음", "메뉴선택쉬움"].slice(0, max)
          : ["단체가능", "모임", "좌석넉넉"].slice(0, max);
  }

  const weakOnly = /^(좋아요|무난해요|편해요|추천)$/;
  const cleaned = out.filter((b) => !weakOnly.test(b.replace(/\s/g, "")));
  return (cleaned.length ? cleaned : out).slice(0, max);
}
