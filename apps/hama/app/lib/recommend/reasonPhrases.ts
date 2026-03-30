import type { IntentionType } from "@/lib/intention";
import type { BusinessState } from "./scoreParts";
import { SCENARIO_TAG_RULES, type RecommendScenarioKey } from "./scenarioWeights";

const SEP = " · ";

function dedupeOrdered(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((t) => {
    if (!t || seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

/**
 * 거리 + 시나리오 핵심 단어 (+ 짧은 힌트 1개까지).
 * 예: 가까운 · 데이트 · 조용 / 근처 · 혼밥 / 가까운 · 아이와 · 주차
 */
export function buildReasonWordLine(params: {
  km: number | null;
  voice: RecommendScenarioKey;
  intent: IntentionType;
  blob: string;
  withKids: boolean;
  category: string | null | undefined;
}): string {
  const { km, voice, intent, blob, withKids } = params;
  const has = (re: RegExp) => re.test(blob);

  const kidSignal =
    withKids ||
    /아이(?!스)|키즈|유아|어린이|아이동반/.test(blob);

  const tags: string[] = [];

  if (km != null && km <= 1) tags.push("가까운");
  else if (km != null && km <= 3) tags.push("근처");

  switch (voice) {
    case "date":
      tags.push("데이트");
      if (has(/조용/)) tags.push("조용");
      else if (has(/디저트|브런치/)) tags.push("디저트");
      break;
    case "family":
      tags.push(kidSignal ? "아이와" : "가족");
      if (has(/주차/)) tags.push("주차");
      break;
    case "solo": {
      const cat = String(params.category ?? "").toLowerCase();
      tags.push(cat === "salon" ? "1인" : "혼밥");
      if (has(/빠른|간단/)) tags.push("빠른");
      break;
    }
    case "group":
      tags.push("단체");
      if (intent === "meeting" || has(/회식/)) tags.push("회식");
      else if (has(/예약/)) tags.push("예약");
      else if (has(/술|맥주|소주/)) tags.push("술");
      break;
    default:
      tags.push("추천");
  }

  const out = dedupeOrdered(tags).slice(0, 4);
  return out.length > 0 ? out.join(SEP) : "추천";
}

function topScenarioTagLabels(voice: RecommendScenarioKey, blob: string, max: number): string[] {
  const rules = SCENARIO_TAG_RULES[voice] ?? [];
  const hits = rules.filter((r) => r.patterns.some((p) => p.test(blob)));
  hits.sort((a, b) => b.weight - a.weight);
  return hits.slice(0, max).map((h) => h.id);
}

function distanceClause(km: number | null): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km <= 0.5) return "바로 근처에 있어요";
  if (km <= 1) return "도보로 가기 좋은 거리예요";
  if (km <= 3) return "거리는 가까운 편이에요";
  return "거리는 조금 있는 편이에요";
}

function businessClause(state: BusinessState): string {
  switch (state) {
    case "OPEN":
      return "지금 영업 중이에요";
    case "LAST_ORDER_SOON":
      return "곧 마감이니 서둘러 보세요";
    case "BREAK":
      return "브레이크 시간이 있을 수 있어요";
    case "UNKNOWN":
    default:
      return "영업 시간은 방문 전 확인하는 편이 좋아요";
  }
}

function scenarioClause(params: {
  voice: RecommendScenarioKey;
  intent: IntentionType;
  blob: string;
  withKids: boolean;
  category: string | null | undefined;
}): string {
  const { voice, intent, blob, withKids } = params;
  const kidSignal =
    withKids || /아이(?!스)|키즈|유아|어린이|아이동반/.test(blob);

  switch (voice) {
    case "date":
      return "데이트 상황에 어울리는 곳이에요";
    case "family":
      return kidSignal ? "아이 동반에 무난한 곳이에요" : "가족 단위로 가기 좋아요";
    case "solo": {
      const cat = String(params.category ?? "").toLowerCase();
      return cat === "salon" ? "혼자 이용하기 편한 곳이에요" : "혼밥·혼술에 부담이 적어요";
    }
    case "group":
      return intent === "meeting" || /회식/.test(blob)
        ? "회식·모임에 맞는 편이에요"
        : "여럿이 함께 쓰기 좋아요";
    default:
      return "상황에 맞는 추천이에요";
  }
}

/**
 * LLM 없이 시나리오·태그·거리·영업을 한 문장으로 묶은 추천 이유.
 */
export function buildHomeRecommendationReason(params: {
  voice: RecommendScenarioKey;
  intent: IntentionType;
  business: BusinessState;
  km: number | null;
  blob: string;
  withKids: boolean;
  category: string | null | undefined;
}): string {
  const { voice, business, km, blob } = params;
  const head = scenarioClause(params);
  const tags = topScenarioTagLabels(voice, blob, 2);
  const tagMid =
    tags.length > 0 ? `주요 매력은 ${tags.join("·")} 쪽이에요` : null;
  const dist = distanceClause(km);
  const biz = businessClause(business);

  const parts = [head, tagMid, dist, biz].filter(Boolean) as string[];
  return `${parts.join(", ")}.`;
}
