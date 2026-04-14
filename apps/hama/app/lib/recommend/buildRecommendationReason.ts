/**
 * 결정형 UX — 카드·상세 공통 "추천 이유" 블록 (headline / subline / badges).
 * 랭킹 점수와 별개로, 사용자가 왜 이곳인지 바로 읽히게 하는 카피.
 */
import type { HomeCard } from "@/lib/storeTypes";
import { businessStateFromCard } from "@/lib/recommend/scoreParts";

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

function pickBadges(card: HomeCard, max = 3): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (!t || out.includes(t) || out.length >= max) return;
    out.push(t);
  };

  const b = blob(card);
  if (card.with_kids === true || /아이|키즈|유아|가족|키즈/.test(b)) push("아이 동반");
  if (/(주차|발렛|parking)/i.test(b)) push("주차 확인");
  if (card.reservation_required === true) push("예약 권장");
  if (/(조용|한적|차분)/.test(b)) push("조용한 편");
  if (/(데이트|분위기)/.test(b)) push("분위기");
  if (card.for_work === true) push("혼밥·업무");

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
  for (const m of card.mood ?? []) {
    push(String(m));
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

/**
 * 홈 카드·상세 상단 배너에서 동일 사용.
 */
export function buildRecommendationReason(card: HomeCard): RecommendationReasonBlock {
  const b = blob(card);
  const km = typeof card.distanceKm === "number" ? card.distanceKm : null;
  const biz = businessStateFromCard(card);
  const dist = distanceSubline(km);

  let headline = "오늘 가기 좋은 곳이에요";
  let subline = "이 근처에서 무난하게 즐기기 좋아요";

  if (card.with_kids === true || /아이|키즈|유아|가족|영유아|초등/.test(b)) {
    headline = "아이랑 가기 좋아요";
    subline = "좌석·동선이 부담 없고 가족 방문에 잘 맞아요";
  } else if (/부모|어머니|아버지|어른/.test(b)) {
    headline = "부모님과 가기 좋아요";
    subline = "무리 없이 식사하기 좋은 분위기예요";
  } else if (/혼자|혼밥|1인|솔로/.test(b) || card.for_work === true) {
    headline = "혼자 가기 편해요";
    subline = "부담 없이 들르기 좋은 곳이에요";
  } else if (/데이트|기념|분위기/.test(b)) {
    headline = "분위기 챙기기 좋아요";
    subline = "오래 머물며 대화하기 좋은 편이에요";
  } else if (/조용|한적|잔잔/.test(b)) {
    headline = "조용하게 쉬기 좋아요";
    subline = "시끄럽지 않게 머물기 편해요";
  }

  if (biz === "CLOSED") {
    headline = "영업 시간 확인이 필요해요";
    subline = "가기 전에 전화나 지도에서 영업 여부를 확인해 주세요";
  } else if (dist) {
    subline = `${subline} · ${dist}`;
  }

  const badges = pickBadges(card, 3);
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
  if (/아이|가족|키즈/.test(reason.headline)) {
    bullets.push("아이와 방문하기 편한 동선이에요");
    bullets.push("가족 단위 손님이 많이 찾는 분위기예요");
  } else if (/혼자|혼밥/.test(reason.headline)) {
    bullets.push("혼자 들러도 부담 없는 구성이에요");
    bullets.push("빠르게 식사하기 좋아요");
  } else {
    bullets.push("지금 상황에 무난하게 맞춰 골랐어요");
    bullets.push("가기 전에 전화나 리뷰로 한 번 더 확인해 주세요");
  }
  if (typeof card.distanceKm === "number" && card.distanceKm <= 2) {
    bullets.push("이동 거리가 부담 없는 편이에요");
  }
  return bullets.slice(0, 3);
}
