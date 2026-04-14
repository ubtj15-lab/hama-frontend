/**
 * 결정형 UX — 카드·상세 공통 "추천 이유" 블록 (headline / subline / badges).
 * 랭킹의 recommendationVoice·슬롯을 반영해 family 문구 과다 반복을 줄임.
 */
import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendScenarioKey } from "@/lib/recommend/scenarioWeights";
import { businessStateFromCard } from "@/lib/recommend/scoreParts";
import { hasExplicitFamilySignalsInBlob } from "@/lib/recommend/enrichScenarioBlob";

export type RecommendationReasonBlock = {
  headline: string;
  subline: string;
  /** 2~3개, 짧은 상황형 라벨 */
  badges: string[];
  /** 지역 신뢰 한 줄 (오산/동탄 등) */
  regionTrust?: string;
};

function blob(card: HomeCard): string {
  const parts = [
    card.name,
    card.description,
    ...(card.tags ?? []),
    ...(card.mood ?? []),
    ...(card.menu_keywords ?? []),
    card.area,
    card.address,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return parts.replace(/\s+/g, " ");
}

function regionTrustLine(card: HomeCard): string | undefined {
  const t = `${card.area ?? ""} ${card.address ?? ""}`;
  if (/오산/.test(t)) return "오산에서 가기 부담 없는 선택이에요";
  if (/동탄/.test(t)) return "동탄에서 바로 가기 좋은 편이에요";
  if (/평택/.test(t)) return "평택 근처에서 무난한 선택이에요";
  if (/오산|동탄|평택/.test(t)) return "이 근처에서 괜찮은 선택이에요";
  return undefined;
}

/** family 헤드라인은 DB/텍스트에 명시적 가족·아이 신호가 있을 때만 */
function allowFamilyHeadline(card: HomeCard, b: string): boolean {
  if (card.recommendationVoice === "family") return true;
  return card.with_kids === true && hasExplicitFamilySignalsInBlob(b);
}

function pickBadges(card: HomeCard, voice: RecommendScenarioKey | undefined, max = 3): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (!t || out.includes(t) || out.length >= max) return;
    out.push(t);
  };

  const b = blob(card);

  if (voice === "date") {
    push("분위기");
    push("데이트");
  } else if (/분위기|데이트|감성|야경|브런치|디저트/.test(b)) {
    push("분위기");
  }
  if (voice === "solo") {
    push("혼밥·가벼운 식사");
    push("가성비");
  } else if (/혼밥|1인|카운터|가성비|빠른/.test(b)) {
    push("혼밥");
  }
  if (voice === "family") {
    push("가족·아이");
  } else if (allowFamilyHeadline(card, b) && /아이|키즈|가족|유아/.test(b)) {
    push("아이 동반");
  }
  if (/(주차|발렛|parking)/i.test(b)) push("주차 확인");
  if (card.reservation_required === true) push("예약 권장");
  if (/(조용|한적|차분)/.test(b)) push("조용한 편");

  const cat = String(card.category ?? "").toLowerCase();
  if (out.length < max) {
    if (cat === "restaurant") push("식사");
    else if (cat === "cafe") push("카페");
    else if (cat === "activity") push("놀거리");
    else if (cat === "salon") push("미용");
  }

  for (const t of card.tags ?? []) {
    push(String(t));
    if (out.length >= max) break;
  }

  return out.slice(0, max);
}

function distanceSubline(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km <= 0.8) return "지금 위치에서 가깝게 이동할 수 있어요";
  if (km <= 2) return "이동 부담이 크지 않은 거리예요";
  if (km <= 5) return "조금만 이동하면 도착해요";
  return null;
}

const HEADLINE_VARIATIONS: Record<
  RecommendScenarioKey,
  { headline: string; subline: string }[]
> = {
  family: [
    { headline: "아이랑 가기 좋아요", subline: "좌석·동선이 부담 없고 가족 방문에 잘 맞아요" },
    { headline: "가족 외식으로 무난해요", subline: "메뉴·좌석 구성이 부담 없는 편이에요" },
  ],
  date: [
    { headline: "데이트로 분위기 좋아요", subline: "오래 머물며 대화하기 좋은 분위기예요" },
    { headline: "분위기 챙기기 좋아요", subline: "감성·인테리어를 기대해도 좋아요" },
    { headline: "조용하게 대화하기 좋아요", subline: "한적하게 앉아 있기 좋은 편이에요" },
  ],
  solo: [
    { headline: "혼자 가볍게 들르기 좋아요", subline: "부담 없이 한 끼 하기 좋은 곳이에요" },
    { headline: "혼밥하기 편해요", subline: "빠르게 식사하고 나오기 좋아요" },
    { headline: "가성비 챙기기 좋아요", subline: "한 끼 부담 없이 즐기기 좋아요" },
  ],
  group: [
    { headline: "여럿이 모이기 좋아요", subline: "단위 모임·회식으로 무난한 편이에요" },
    { headline: "자리 넉넉한 편이에요", subline: "인원 나눠 앉기 부담이 적어요" },
  ],
};

export type BuildRecommendationReasonOptions = {
  /** 결과 덱에서의 순번(0~2) — 같은 voice여도 문구 분산 */
  deckSlot?: number;
};

/**
 * 홈 카드·상세 상단 배너에서 동일 사용.
 */
export function buildRecommendationReason(
  card: HomeCard,
  opts?: BuildRecommendationReasonOptions
): RecommendationReasonBlock {
  const b = blob(card);
  const km = typeof card.distanceKm === "number" ? card.distanceKm : null;
  const biz = businessStateFromCard(card);
  const dist = distanceSubline(km);
  const slot = opts?.deckSlot ?? 0;
  /** 없으면 generic 분기(거리·분위기 등), 기본을 solo로 두지 않음 */
  const voice = card.recommendationVoice;

  let headline = "오늘 가기 좋은 곳이에요";
  let subline = "이 근처에서 무난하게 즐기기 좋아요";

  if (biz === "CLOSED") {
    headline = "영업 시간 확인이 필요해요";
    subline = "가기 전에 전화나 지도에서 영업 여부를 확인해 주세요";
  } else if (voice === "family") {
    const pool = HEADLINE_VARIATIONS.family;
    const pick = pool[slot % pool.length]!;
    headline = pick.headline;
    subline = pick.subline;
  } else if (voice === "date") {
    const pool = HEADLINE_VARIATIONS.date;
    const pick = pool[slot % pool.length]!;
    headline = pick.headline;
    subline = pick.subline;
  } else if (voice === "solo") {
    const pool = HEADLINE_VARIATIONS.solo;
    const pick = pool[slot % pool.length]!;
    headline = pick.headline;
    subline = pick.subline;
  } else if (voice === "group") {
    const pool = HEADLINE_VARIATIONS.group;
    const pick = pool[slot % pool.length]!;
    headline = pick.headline;
    subline = pick.subline;
  } else {
    /** generic / voice 없음: 태그만으로 family 문구 금지, 거리·분위기·조용 우선 */
    if (km != null && km <= 1.2) {
      headline = "지금 가기 편해요";
      subline = dist ?? "이동 부담이 적은 편이에요";
    } else if (/데이트|분위기|감성|야경|브런치/.test(b)) {
      headline = "분위기 챙기기 좋아요";
      subline = "대화·분위기 모두 챙기기 좋은 편이에요";
    } else if (/혼밥|혼자|1인|카운터/.test(b) || card.for_work === true) {
      headline = "혼자 가기 편해요";
      subline = "부담 없이 들르기 좋은 곳이에요";
    } else if (/조용|한적|잔잔/.test(b)) {
      headline = "조용하게 쉬기 좋아요";
      subline = "시끄럽지 않게 머물기 편해요";
    } else if (/부모|어머니|아버지/.test(b)) {
      headline = "부모님과 가기 좋아요";
      subline = "무리 없이 식사하기 좋은 분위기예요";
    } else if (allowFamilyHeadline(card, b)) {
      const pool = HEADLINE_VARIATIONS.family;
      const pick = pool[slot % pool.length]!;
      headline = pick.headline;
      subline = pick.subline;
    }
  }

  if (biz !== "CLOSED" && dist && !subline.includes(dist)) {
    subline = `${subline} · ${dist}`;
  }

  const badges = pickBadges(card, card.recommendationVoice ?? undefined, 3);
  const regionTrust = regionTrustLine(card);

  return {
    headline,
    subline,
    badges: badges.length ? badges : ["추천"],
    regionTrust,
  };
}

/** 상세 "이런 이유로 추천했어요"용 불릿 2~3개 */
export function buildRecommendationBullets(card: HomeCard): string[] {
  const reason = buildRecommendationReason(card);
  const bullets: string[] = [];
  const v = card.recommendationVoice;
  if (v === "family" || /아이|가족/.test(reason.headline)) {
    bullets.push("아이와 방문하기 편한 동선이에요");
    bullets.push("가족 단위로 찾기 좋은 분위기예요");
  } else if (v === "date" || /데이트|분위기/.test(reason.headline)) {
    bullets.push("대화하기 좋은 분위기예요");
    bullets.push("데이트로 기대해도 좋아요");
  } else if (v === "solo" || /혼자|혼밥/.test(reason.headline)) {
    bullets.push("혼자 들러도 부담 없는 구성이에요");
    bullets.push("가볍게 한 끼 하기 좋아요");
  } else {
    bullets.push("이 근처에서 무난한 선택이에요");
    bullets.push("가기 전에 전화나 리뷰로 한 번 더 확인해 주세요");
  }
  if (typeof card.distanceKm === "number" && card.distanceKm <= 2) {
    bullets.push("이동 거리가 부담 없는 편이에요");
  }
  return bullets.slice(0, 3);
}
