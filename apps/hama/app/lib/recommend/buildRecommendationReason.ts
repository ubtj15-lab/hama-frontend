/**
 * 결정형 UX — 카드·상세 공통 "추천 이유" 블록 (headline / subline / badges).
 * 사용자 요청 시나리오(requestedScenario)가 있으면 카드 recommendationVoice보다 우선한다.
 */
import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendScenarioKey } from "@/lib/recommend/scenarioWeights";
import { businessStateFromCard, type BusinessState } from "@/lib/recommend/scoreParts";
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
  /** 추천 이유 첫 줄 — 상황 라벨 */
  scenarioLabel: string;
  /** 오늘 [요일] [시간], [상황] */
  timeContextLine?: string;
  /** 지금 가면 [상태] */
  liveStatusLine?: string;
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
  if (/오산/.test(t)) return "오산에서 이동 부담 적은 편이에요";
  if (/동탄/.test(t)) return "동탄에서 바로 가기 좋은 편이에요";
  if (/평택/.test(t)) return "평택 근처에서 동선 짧게 가기 좋아요";
  if (/오산|동탄|평택/.test(t)) return "이 근처에서 바로 실행하기 좋아요";
  return undefined;
}

function distanceSubline(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km <= 0.8) return "지금 위치에서 가깝게 이동할 수 있어요";
  if (km <= 2) return "이동 부담이 크지 않은 거리예요";
  if (km <= 5) return "조금만 이동하면 도착해요";
  return null;
}

function mergeMainDecisionBadges(
  base: string[],
  voice: RecommendScenarioKey | undefined,
  biz: BusinessState,
  km: number | null,
  b: string,
  card: HomeCard
): string[] {
  const add: string[] = [];
  if (biz === "OPEN" || biz === "LAST_ORDER_SOON") add.push("지금 가면 대기 거의 없을 수 있어요");
  if (km != null && km <= 1.8) add.push("근처에서 실패 확률 낮은 거리예요");
  if (voice === "family" && !shouldBlockKidFriendlyMessaging(card) && childFriendlyScore(card) >= 0.4) {
    add.push("아이 데리고 앉기 편한 구조를 봤어요");
  }
  if (voice === "date" && /조용|감성|야경|대화/.test(b)) add.push("대화·분위기에 집중하기 좋아요");
  if (voice === "solo" && /혼밥|1인|가성비|빠른/.test(b)) add.push("혼자서도 빠르게 결정하기 좋아요");
  const merged = [...add, ...base];
  const seen = new Set<string>();
  const out = merged.filter((x) => {
    if (!x || seen.has(x)) return false;
    seen.add(x);
    return true;
  });
  return out.slice(0, 3);
}

export type BuildRecommendationReasonOptions = {
  /** 결과 덱에서의 순번(0~2) — 같은 voice여도 문구 분산 */
  deckSlot?: number;
  /** 메인 / 거리 차선 / 다른 장점 차선 */
  deckRole?: "main" | "near" | "alt";
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
  /** 온보딩 companions — 상단 라벨(복수 가능) */
  profileCompanions?: string[];
};

function scenarioLabelLineFromCompanions(companions: string[] | undefined): string | null {
  if (!companions?.length) return null;
  const labels: string[] = [];
  const add = (cond: boolean, text: string) => {
    if (!cond) return;
    if (!labels.includes(text)) labels.push(text);
  };
  // 안정적인 출력 순서
  add(companions.includes("가족"), "🔥 아이랑 가기 좋아");
  add(companions.includes("둘이서"), "🔥 데이트 분위기");
  add(companions.includes("혼자"), "🔥 혼자 가기 편해");
  add(companions.includes("친구"), "🔥 친구랑 가기 좋아");
  if (!labels.length) return null;
  return labels.join("\n");
}

function dayNameKo(day: number): string {
  return ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][day] ?? "오늘";
}

function timeBandKo(hours: number): string {
  if (hours < 10) return "아침";
  if (hours < 15) return "점심";
  if (hours < 19) return "저녁";
  return "밤";
}

function scenarioContextKo(
  voice: RecommendScenarioKey | undefined,
  companions: string[] | undefined
): string {
  if (companions?.includes("가족")) return "가족 외식";
  if (companions?.includes("둘이서")) return "데이트";
  if (companions?.includes("혼자")) return "혼밥";
  if (companions?.includes("친구")) return "친구 모임";
  if (voice === "family") return "가족 외식";
  if (voice === "date") return "데이트";
  if (voice === "solo") return "혼밥";
  if (voice === "group") return "친구 모임";
  return "지금 일정";
}

function buildTimeContextLine(
  voice: RecommendScenarioKey | undefined,
  companions: string[] | undefined
): string {
  const now = new Date();
  return `오늘 ${dayNameKo(now.getDay())} ${timeBandKo(now.getHours())}, ${scenarioContextKo(voice, companions)}`;
}

function buildLiveStatusLine(card: HomeCard, biz: BusinessState, b: string): string | undefined {
  if (/대기\s?\d+분|웨이팅\s?\d+분/.test(b)) {
    const m = b.match(/(대기|웨이팅)\s?(\d+)\s?분/);
    if (m?.[2]) return `지금 가면 대기 ${m[2]}분`;
  }
  if (/한산|안\s?붐빔|여유/.test(b)) return "지금 안 붐벼요";
  if (biz === "OPEN" || biz === "LAST_ORDER_SOON") return "지금 영업 중";
  return undefined;
}

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
  const role = opts?.deckRole ?? (slot === 0 ? "main" : slot === 1 ? "near" : "alt");
  const voice = resolveEffectiveRecommendationVoice(card, opts);
  const serving = opts?.servingType ?? inferServingTypeForRecommendation(card);

  let headline = "오늘 가기 좋은 곳이에요";
  let subline = "시간·동선·실행까지 한 번에 고려한 선택이에요";
  let skipVoiceCopy = false;

  if (biz === "CLOSED") {
    headline = "영업 시간 확인이 필요해요";
    subline = "가기 전에 전화나 지도에서 영업 여부를 확인해 주세요";
  } else if (role === "near") {
    headline =
      km != null && km <= 1.2 ? "거리를 먼저 본 가까운 차선이에요" : "이동이 짧게 끝나는 근거리예요";
    subline =
      km != null && km <= 1.2
        ? "지금 시간에 바로 가면 실행이 쉬워요"
        : "다음 일정까지 붙여 가기 좋은 선택이에요";
    skipVoiceCopy = true;
  } else if (role === "alt") {
    headline = "메인과 다른 장점을 살린 차선이에요";
    subline = "가성비·분위기·활동성 중 한쪽이 더 두드러져요";
    skipVoiceCopy = true;
  }

  if (biz === "CLOSED") {
    /* noop */
  } else if (!skipVoiceCopy && voice === "family") {
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
  } else if (!skipVoiceCopy && (voice === "date" || voice === "solo" || voice === "group")) {
    const picked = pickRecommendationPair({
      scenario: voice,
      serving,
      deckSlot: slot,
      usedHeadlines: opts?.usedHeadlines,
      usedSublines: opts?.usedSublines,
    });
    headline = picked.headline;
    subline = picked.subline;
  } else if (!skipVoiceCopy && !voice) {
    /** 시나리오 미지정 — 태그로 date/solo/family를 덮어쓰지 않고 light·시간·거리만 보조 */
    const tod = opts?.timeOfDay;
    if (tod === "lunch" && biz === "OPEN") {
      headline = "점심 한 끼 정하기 좋아요";
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

  if (biz === "UNKNOWN") {
    subline = subline.includes("영업 정보") ? subline : `${subline} · 영업 정보는 방문 전 확인해 주세요`;
  }

  if (card.category === "museum" || /박물관|museum|전시/.test(b)) {
    headline = "오늘 비 와서 실내 체험 좋아";
    if (/아이|키즈|체험/.test(b)) {
      subline = "아이가 좋아할 만한 전시 진행 중";
    } else {
      subline = "데이트 코스 마무리하기 좋은 분위기";
    }
  }

  if (biz !== "CLOSED" && dist && !subline.includes(dist)) {
    subline = `${subline} · ${dist}`;
  }

  let badges = selectRecommendationBadges({
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

  if (biz !== "CLOSED" && role === "main") {
    badges = mergeMainDecisionBadges(badges, voice, biz, km, b, card);
  } else if (biz !== "CLOSED" && role === "near") {
    badges = [
      km != null && km <= 1.5 ? "바로 도착 동선" : "이동 짧게",
      "근거리 차선",
      "지금 정하기 좋은 선택",
    ];
  } else if (biz !== "CLOSED" && role === "alt") {
    badges = ["메인과 다른 매력", "가성비·분위기·활동 중 보강", "차선으로 두기 좋아요"];
  }

  const regionTrust = regionTrustLine(card);

  const scenarioLabel =
    scenarioLabelLineFromCompanions(opts?.profileCompanions) ??
    (voice === "family"
      ? "🔥 아이랑 가기 좋아"
      : voice === "date"
        ? "🔥 데이트 분위기"
        : voice === "solo"
          ? "🔥 혼자 가기 편해"
          : voice === "group"
            ? "🔥 친구랑 가기 좋아"
            : "🔥 지금 가기 좋아");

  return {
    scenarioLabel,
    timeContextLine: buildTimeContextLine(voice, opts?.profileCompanions),
    liveStatusLine: buildLiveStatusLine(card, biz, b),
    headline,
    subline,
    badges: badges.length ? badges : ["지금 결정하기 좋아요", "동선 짧게", "실행 부담 적게"],
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
    bullets.push("지금 가면 대기가 길지 않을 가능성이 있어요");
    bullets.push("아이 데리고 앉기 편한 구조예요");
  } else if (v === "family" && shouldBlockKidFriendlyMessaging(card)) {
    bullets.push("메뉴·가격대는 방문 전에 한 번 더 확인해 보세요");
    bullets.push("근처에서 실패 확률을 줄이려면 리뷰를 함께 봐 주세요");
  } else if (v === "date" || /데이트|둘이|연인|코스로/.test(reason.headline)) {
    bullets.push("대화하기 좋은 분위기예요");
    bullets.push("시간대에 맞춰 동선 짧게 이어가기 좋아요");
  } else if (v === "solo" || /혼자|혼밥|잠깐/.test(reason.headline)) {
    bullets.push("혼자 들러도 부담 없는 구성이에요");
    if (serving !== "drink") {
      bullets.push("빠르게 한 끼 정리하기 좋아요");
    } else {
      bullets.push("잠깐 쉬었다 가기 좋아요");
    }
  } else {
    bullets.push("지금 시간·거리 기준으로 실행하기 쉬워요");
    bullets.push("가기 전에 전화나 리뷰로 한 번 더 확인해 주세요");
  }
  if (typeof card.distanceKm === "number" && card.distanceKm <= 2) {
    bullets.push("이동 거리가 부담 없는 편이에요");
  }
  return bullets.slice(0, 3);
}
