import type { HomeCard, RecommendationBadge } from "@/lib/storeTypes";
import type { RecommendScenarioKey } from "./scenarioWeights";
import { SCENARIO_TAG_RULES, scenarioCategoryBonusMax } from "./scenarioWeights";
import type { BusinessState } from "./scoreParts";
import { businessStateFromCard } from "./scoreParts";
import {
  BADGE_MIN_RAW_FOR_INFERRED_LABEL,
  GENERIC_PRIMARY_LABEL,
  PRIMARY_LABEL_ALTERNATES,
  PRIMARY_LABEL_BY_SCENARIO,
  SCENARIO_EXTRA_TAGS,
  TAG_ID_TO_DISPLAY,
  type ScenarioExtraTagDef,
} from "./recommendationBadgeConstants";

export type BuildRecommendationBadgeOptions = {
  /** norm 된 검색 텍스트 (scoring 의 normBlob 과 동일 권장) */
  blob?: string;
  businessState?: BusinessState;
  distanceKm?: number | null;
  /**
   * 사용자가 고른 의도(intention → scenario). 있으면 라벨·shortTags 모두 이 시나리오 기준 (카드 태그로 덮어쓰지 않음).
   */
  explicitScenario?: RecommendScenarioKey;
  /**
   * intent 가 neutral 일 때만 scoring 쪽에서 넣음. 라벨은 raw 가 충분할 때만 시나리오명, 아니면 GENERIC.
   */
  neutralInference?: { key: RecommendScenarioKey; raw: number };
  /** scenario config 의 primaryBadgeLabel 등 — 장소 태그보다 우선 */
  primaryLabelOverride?: string;
};

export function getPrimaryLabel(scenario: RecommendScenarioKey): string {
  return PRIMARY_LABEL_ALTERNATES[scenario] ?? PRIMARY_LABEL_BY_SCENARIO[scenario];
}

/** 명시 시나리오 → 라벨, 없으면 추론+임계값, 그것도 애매하면 일반 라벨 */
export function resolvePrimaryLabel(params: {
  explicitScenario?: RecommendScenarioKey;
  neutralInference?: { key: RecommendScenarioKey; raw: number };
}): string {
  if (params.explicitScenario) return getPrimaryLabel(params.explicitScenario);
  const inf = params.neutralInference;
  if (inf && inf.raw >= BADGE_MIN_RAW_FOR_INFERRED_LABEL) return getPrimaryLabel(inf.key);
  return GENERIC_PRIMARY_LABEL;
}

function scenarioRawForBadge(blob: string, key: RecommendScenarioKey, card: HomeCard): number {
  let sum = 0;
  for (const rule of SCENARIO_TAG_RULES[key]) {
    if (rule.patterns.some((re) => re.test(blob))) sum += rule.weight;
  }
  sum += scenarioCategoryBonusMax(blob, key);
  const c = card as any;
  if (key === "family" && c?.with_kids === true) sum += 20;
  if (key === "solo" && c?.for_work === true) sum += 12;
  if (key === "group" && c?.reservation_required === true) sum += 14;
  return sum;
}

/**
 * intent 가 없을 때 카드 텍스트로 승자만 고름 (점수용 pickActiveScenario 와 분리).
 * 가족 규칙이 흔한 편의 키워드에 과민하게 반응하지 않도록, 강한 가족 신호 없으면 family 만 보정.
 */
export function inferScenarioForBadgeWhenNeutral(
  card: HomeCard,
  blob: string
): { key: RecommendScenarioKey; raw: number } {
  const keys: RecommendScenarioKey[] = ["date", "family", "solo", "group"];
  let bestK: RecommendScenarioKey = "solo";
  let bestAdj = -1;
  let rawAtBest = 0;

  for (const k of keys) {
    const raw = scenarioRawForBadge(blob, k, card);
    let adj = raw;
    if (k === "family") {
      const strongFamily = /키즈|유아|아이동반|영유아|가족모임|키즈존|키즈\s*룸/.test(blob);
      if (!strongFamily) adj = raw * 0.72;
    }
    if (adj > bestAdj) {
      bestAdj = adj;
      bestK = k;
      rawAtBest = raw;
    }
  }

  if (bestAdj <= 0) {
    const cat = String(card.category ?? "").toLowerCase();
    if (cat === "cafe" || cat === "activity") bestK = "date";
    else if (cat === "salon") bestK = "solo";
    else if (cat === "restaurant") bestK = "group";
    else bestK = "date";
    rawAtBest = scenarioRawForBadge(blob, bestK, card);
  }

  return { key: bestK, raw: rawAtBest };
}

/** rule id 또는 이미 표시용 문자열 → UI 라벨 */
export function normalizeTagLabel(idOrLabel: string): string {
  const mapped = TAG_ID_TO_DISPLAY[idOrLabel.trim()];
  if (mapped) return mapped;
  return idOrLabel.trim();
}

export function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const k = t.replace(/\s+/g, "").toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function placeBlob(card: HomeCard): string {
  const c = card as any;
  const parts: string[] = [];
  if (c?.name) parts.push(String(c.name));
  if (c?.category) parts.push(String(c.category));
  if (c?.address) parts.push(String(c.address));
  if (Array.isArray(c?.tags)) parts.push(c.tags.join(" "));
  if (Array.isArray(c?.mood)) parts.push(c.mood.join(" "));
  if (c?.moodText) parts.push(String(c.moodText));
  if (typeof c?.description === "string") parts.push(c.description);
  return parts
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tagOverlapsExisting(existing: string[], label: string): boolean {
  const n = label.replace(/\s+/g, "").toLowerCase();
  if (!n) return true;
  return existing.some((e) => {
    const x = e.replace(/\s+/g, "").toLowerCase();
    return x.includes(n) || n.includes(x);
  });
}

function collectScenarioCandidates(
  scenario: RecommendScenarioKey,
  blob: string
): { label: string; weight: number; tier: 0 }[] {
  const out: { label: string; weight: number; tier: 0 }[] = [];
  for (const rule of SCENARIO_TAG_RULES[scenario]) {
    if (!rule.patterns.some((re) => re.test(blob))) continue;
    out.push({ label: normalizeTagLabel(rule.id), weight: rule.weight, tier: 0 });
  }
  for (const extra of SCENARIO_EXTRA_TAGS.filter((e: ScenarioExtraTagDef) => e.scenario === scenario)) {
    if (!extra.patterns.some((re) => re.test(blob))) continue;
    out.push({ label: extra.label, weight: extra.weight, tier: 0 });
  }
  out.sort((a, b) => b.weight - a.weight);
  return out;
}

function collectFacilityTier(
  card: HomeCard,
  blob: string,
  existing: string[]
): { label: string; weight: number; tier: 1 }[] {
  const out: { label: string; weight: number; tier: 1 }[] = [];
  const parking =
    (card as any).parking_available === true ||
    (card as any).parkingAvailable === true ||
    /주차|무료주차|발렛/.test(blob);
  if (parking && !tagOverlapsExisting(existing, "주차")) {
    out.push({ label: "주차 가능", weight: 19, tier: 1 });
  }
  const reservation =
    card.reservation_required === true ||
    (card as any).reservation_available === true ||
    /예약\s*가능|단체예약/.test(blob);
  if (reservation && !tagOverlapsExisting(existing, "예약")) {
    out.push({ label: "예약 가능", weight: 18, tier: 1 });
  }
  return out;
}

function collectAuxiliaryTier(
  businessState: BusinessState,
  distanceKm: number | null
): { label: string; weight: number; tier: 2 }[] {
  const out: { label: string; weight: number; tier: 2 }[] = [];
  if (businessState === "LAST_ORDER_SOON") out.push({ label: "곧 마감", weight: 30, tier: 2 });
  else if (businessState === "OPEN") out.push({ label: "영업중", weight: 20, tier: 2 });

  if (distanceKm != null && Number.isFinite(distanceKm)) {
    const m = distanceKm * 1000;
    if (m <= 500) out.push({ label: "매우 가까움", weight: 25, tier: 2 });
    else if (m <= 1000) out.push({ label: "가까움", weight: 15, tier: 2 });
  }
  return out;
}

const MAX_SHORT_TAGS = 3;
const MIN_REPRESENTATIVE_TAGS = 2;

/**
 * 시나리오·편의·(부족 시) 영업·거리 태그를 최대 3개까지 고릅니다.
 */
export function pickShortTags(
  place: HomeCard,
  scenario: RecommendScenarioKey,
  blob: string,
  opts: { businessState: BusinessState; distanceKm: number | null }
): string[] {
  const tier0 = collectScenarioCandidates(scenario, blob);
  const scenarioLabels: string[] = [];
  for (const t of tier0) {
    if (scenarioLabels.length >= MAX_SHORT_TAGS) break;
    if (tagOverlapsExisting(scenarioLabels, t.label)) continue;
    scenarioLabels.push(t.label);
  }

  let merged = dedupeTags([...scenarioLabels]);
  const tier1 = collectFacilityTier(place, blob, merged);
  tier1.sort((a, b) => b.weight - a.weight);
  for (const t of tier1) {
    if (merged.length >= MAX_SHORT_TAGS) break;
    if (tagOverlapsExisting(merged, t.label)) continue;
    merged.push(t.label);
  }
  merged = dedupeTags(merged);

  if (merged.length < MIN_REPRESENTATIVE_TAGS) {
    const aux = collectAuxiliaryTier(opts.businessState, opts.distanceKm);
    aux.sort((a, b) => b.weight - a.weight);
    for (const t of aux) {
      if (merged.length >= MAX_SHORT_TAGS) break;
      if (tagOverlapsExisting(merged, t.label)) continue;
      merged.push(t.label);
    }
    merged = dedupeTags(merged);
  }

  return merged.slice(0, MAX_SHORT_TAGS);
}

export function buildRecommendationBadge(place: HomeCard, options?: BuildRecommendationBadgeOptions): RecommendationBadge {
  const blob = options?.blob ?? placeBlob(place);
  const businessState = options?.businessState ?? businessStateFromCard(place);
  const distanceKm =
    options?.distanceKm !== undefined
      ? options.distanceKm
      : typeof place.distanceKm === "number"
        ? place.distanceKm
        : null;

  const explicit = options?.explicitScenario;
  const inference =
    options?.neutralInference ?? (!explicit ? inferScenarioForBadgeWhenNeutral(place, blob) : undefined);

  const tagScenario: RecommendScenarioKey = explicit ?? inference!.key;

  const baseLabel = resolvePrimaryLabel({
    explicitScenario: explicit,
    neutralInference: explicit ? undefined : inference,
  });

  return {
    primaryLabel: options?.primaryLabelOverride ?? baseLabel,
    shortTags: pickShortTags(place, tagScenario, blob, { businessState, distanceKm }),
  };
}

/**
 * 수동 스폿 — `buildRecommendationBadge(place, { explicitScenario: 'date', blob, … })`
 *
 * 1) explicit date + "분위기 로맨틱 인생샷 루프탑" → 라벨 데이트 + [분위기 좋음, 사진 맛집, 루프탑]
 * 2) explicit family + "주차 발렛 넓은 좌석" → 라벨 가족 + (가족 규칙 기준 태그)
 * 3) explicit solo → 라벨 혼밥 + (솔로 규칙·보조 태그)
 * 4) neutral + 약한 blob → 라벨 추천 + (완화된 추론 키 기준 shortTags)
 * 5) explicit date + 주차만 있는 매장 → 라벨은 데이트 유지, 주차는 shortTags·보조에만
 */
