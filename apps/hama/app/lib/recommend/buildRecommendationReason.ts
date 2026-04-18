/**
 * 결정형 UX — 카드·상세 공통 "추천 이유" 블록 (headline / subline / badges).
 * 사용자 요청 시나리오(requestedScenario)가 있으면 카드 recommendationVoice보다 우선한다.
 */
import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendScenarioKey } from "@/lib/recommend/scenarioWeights";
import { businessStateFromCard } from "@/lib/recommend/scoreParts";
import { childFriendlyScore, shouldBlockKidFriendlyMessaging } from "@/lib/recommend/childFriendlyScore";
import {
  inferServingTypeForRecommendation,
  pickRecommendationPair,
  type ServingTypeForCopy,
} from "@/lib/recommend/recommendationCopy";
import {
  computeDateFriendlyScore,
  computeSoloFriendlyScore,
  selectRecommendationBadges,
} from "@/lib/recommend/selectRecommendationBadges";

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

function distanceSubline(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km <= 0.8) return "지금 위치에서 가깝게 이동할 수 있어요";
  if (km <= 2) return "이동 부담이 크지 않은 거리예요";
  if (km <= 5) return "조금만 이동하면 도착해요";
  return null;
}

export type BuildRecommendationReasonOptions = {
  /** 결과 덱에서의 순번(0~2) — 같은 voice여도 문구 분산 */
  deckSlot?: number;
  /** 클라이언트에서만 넘기면 점심/저녁 등 시간 문구 보조 */
  timeOfDay?: "morning" | "lunch" | "afternoon" | "evening" | "night";
  /**
   * 검색·결과 화면의 사용자 시나리오 — 있으면 카드 recommendationVoice보다 우선.
   */
  requestedScenario?: RecommendScenarioKey;
  /** 카드·API에서 넘기면 추론보다 우선 (meal / light / drink) */
  servingType?: ServingTypeForCopy;
  /** 같은 덱에서 headline/subline 중복 방지 — build 시 mutate */
  usedHeadlines?: Set<string>;
  usedSublines?: Set<string>;
};

/** 클라이언트에서 점심/저녁 추천 문구 보조용 */
export function getClientTimeOfDay(): BuildRecommendationReasonOptions["timeOfDay"] | undefined {
  if (typeof window === "undefined") return undefined;
  const h = new Date().getHours();
  if (h < 11) return "morning";
  if (h < 15) return "lunch";
  if (h < 18) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

/** 랭킹 카드 voice와 UI 시나리오를 합쳐 headline 축 결정 */
export function resolveEffectiveRecommendationVoice(
  card: HomeCard,
  opts?: BuildRecommendationReasonOptions
): RecommendScenarioKey | undefined {
  const fromUser = opts?.requestedScenario;
  if (fromUser) return fromUser;
  return card.recommendationVoice;
}

/** 홈 카드·상세 상단 배너에서 동일 사용 */
export function buildRecommendationReason(
  card: HomeCard,
  opts?: BuildRecommendationReasonOptions
): RecommendationReasonBlock {
  const b = blob(card);
  const km = typeof card.distanceKm === "number" ? card.distanceKm : null;
  const biz = businessStateFromCard(card);
  const dist = distanceSubline(km);
  const slot = opts?.deckSlot ?? 0;
  const voice = resolveEffectiveRecommendationVoice(card, opts);
  const serving = opts?.servingType ?? inferServingTypeForRecommendation(card);

  let headline = "오늘 가기 좋은 곳이에요";
  let subline = "이 근처에서 무난하게 즐기기 좋아요";

  if (biz === "CLOSED") {
    headline = "영업 시간 확인이 필요해요";
    subline = "가기 전에 전화나 지도에서 영업 여부를 확인해 주세요";
  } else if (voice === "family") {
    const cfs = childFriendlyScore(card);
    if (shouldBlockKidFriendlyMessaging(card)) {
      headline = "이 근처에서 한 끼하기 괜찮은 곳이에요";
      subline = "아이 동반 여부는 메뉴와 분위기를 보고 판단해 주세요";
    } else if (cfs < 0.42) {
      headline = "이 근처에서 한 끼하기 괜찮은 곳이에요";
      subline = "가족과 함께 가기 전에 분위기를 한 번 더 확인해 보세요";
    } else {
      const picked = pickRecommendationPair({
        scenario: "family",
        serving,
        deckSlot: slot,
        usedHeadlines: opts?.usedHeadlines,
        usedSublines: opts?.usedSublines,
      });
      headline = picked.headline;
      subline = picked.subline;
    }
  } else if (voice === "date" || voice === "solo" || voice === "group") {
    const picked = pickRecommendationPair({
      scenario: voice,
      serving,
      deckSlot: slot,
      usedHeadlines: opts?.usedHeadlines,
      usedSublines: opts?.usedSublines,
    });
    headline = picked.headline;
    subline = picked.subline;
  } else if (!voice) {
    /** 시나리오 미지정 — 태그로 date/solo/family를 덮어쓰지 않고 light·시간·거리만 보조 */
    const tod = opts?.timeOfDay;
    if (tod === "lunch" && biz === "OPEN") {
      headline = "점심으로 무난해요";
      subline = "한 끼 부담 없이 들르기 좋은 편이에요";
    } else if (tod === "evening" && biz === "OPEN" && /식당|restaurant|한식|양식|고기/.test(b)) {
      headline = "저녁 식사로 괜찮아요";
      subline = "부담 없이 자리 잡기 좋은 편이에요";
    } else if (km != null && km <= 1.2) {
      headline = "지금 가기 편해요";
      subline = dist ?? "이동 부담이 적은 편이에요";
    } else {
      const picked = pickRecommendationPair({
        scenario: "light",
        serving,
        deckSlot: slot,
        usedHeadlines: opts?.usedHeadlines,
        usedSublines: opts?.usedSublines,
      });
      headline = picked.headline;
      subline = picked.subline;
    }
  }

  if (biz !== "CLOSED" && dist && !subline.includes(dist)) {
    subline = `${subline} · ${dist}`;
  }

  const badges = selectRecommendationBadges({
    scenario: voice,
    serving,
    card,
    blob: b,
    distanceKm: km,
    childFriendlyScore: childFriendlyScore(card),
    dateFriendlyScore: computeDateFriendlyScore(b),
    soloFriendlyScore: computeSoloFriendlyScore(b),
    max: 3,
  });
  const regionTrust = regionTrustLine(card);

  return {
    headline,
    subline,
    badges: badges.length ? badges : ["추천"],
    regionTrust,
  };
}

/** 상세 "이런 이유로 추천했어요"용 불릿 2~3개 */
export function buildRecommendationBullets(
  card: HomeCard,
  opts?: BuildRecommendationReasonOptions
): string[] {
  const reason = buildRecommendationReason(card, {
    timeOfDay: getClientTimeOfDay(),
    ...opts,
  });
  const bullets: string[] = [];
  const v = resolveEffectiveRecommendationVoice(card, opts);
  const serving = opts?.servingType ?? inferServingTypeForRecommendation(card);
  if ((v === "family" || /아이|가족/.test(reason.headline)) && !shouldBlockKidFriendlyMessaging(card)) {
    bullets.push("아이와 방문하기 편한 동선이에요");
    bullets.push("가족 단위로 찾기 좋은 분위기예요");
  } else if (v === "family" && shouldBlockKidFriendlyMessaging(card)) {
    bullets.push("메뉴·가격대는 방문 전에 한 번 더 확인해 보세요");
    bullets.push("이동 거리는 부담 없는 편이에요");
  } else if (v === "date" || /데이트|둘이|연인|코스로/.test(reason.headline)) {
    bullets.push("대화하기 좋은 분위기예요");
    bullets.push("데이트로 기대해도 좋아요");
  } else if (v === "solo" || /혼자|혼밥|잠깐/.test(reason.headline)) {
    bullets.push("혼자 들러도 부담 없는 구성이에요");
    if (serving !== "drink") {
      bullets.push("가볍게 한 끼 하기 좋아요");
    } else {
      bullets.push("가볍게 쉬어가기 좋아요");
    }
  } else {
    bullets.push("이 근처에서 무난한 선택이에요");
    bullets.push("가기 전에 전화나 리뷰로 한 번 더 확인해 주세요");
  }
  if (typeof card.distanceKm === "number" && card.distanceKm <= 2) {
    bullets.push("이동 거리가 부담 없는 편이에요");
  }
  return bullets.slice(0, 3);
}
