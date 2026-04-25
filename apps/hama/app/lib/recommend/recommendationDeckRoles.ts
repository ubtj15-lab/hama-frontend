import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { isPreferredScenarioCategory } from "@/lib/recommend/scenarioCategoryRules";
import type { RecommendScenarioKey } from "@/lib/recommend/scenarioWeights";
import {
  isBackupScenarioConflict,
  isDisqualifiedMainPick,
  rankKeyFromCtx,
} from "@/lib/recommend/scenarioRiskAndFit";

/** scoring.ts 의 ScoredRecommendItem 과 동형 — 순환 import 방지 */
export type DeckScoredItem = {
  card: HomeCard;
  breakdown: {
    scenarioRichScore: number;
    finalScore: number;
    qualityScore: number;
  };
};

function kmOf(item: DeckScoredItem): number {
  const k = item.card.distanceKm;
  return typeof k === "number" && Number.isFinite(k) ? k : 999;
}

function catKey(card: HomeCard): string {
  return String(card.category ?? "").toLowerCase();
}

/**
 * 메인 1 + 보조 2 — 메인은 시나리오·안전 필터, 보조1은 거리, 보조2는 다른 장점 축(카테고리 분리).
 */
export function pickDeckWithBackupRoles(
  sorted: DeckScoredItem[],
  ctx: { scenarioObject?: ScenarioObject | null },
  rankKey: RecommendScenarioKey | "neutral",
  limit: number
): DeckScoredItem[] {
  if (sorted.length === 0) return [];
  if (limit <= 1) return sorted.slice(0, limit);

  const so = ctx.scenarioObject ?? null;
  const normBlob = (card: HomeCard) => {
    const c = card as any;
    return [c?.name, c?.category, ...(card.tags ?? []), ...(card.mood ?? []), c?.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  };

  const preferredFirst = (list: DeckScoredItem[]): DeckScoredItem[] => {
    if (rankKey === "neutral") return list;
    const pref = list.filter((s) => isPreferredScenarioCategory(s.card, rankKey));
    const other = list.filter((s) => !isPreferredScenarioCategory(s.card, rankKey));
    return pref.length ? [...pref, ...other] : list;
  };

  const ordered = preferredFirst([...sorted]);

  const mainPool = ordered.filter(
    (s) =>
      !isDisqualifiedMainPick({
        scenarioObject: so,
        blob: normBlob(s.card),
        scenarioRichScore: s.breakdown.scenarioRichScore,
        card: s.card,
      })
  );
  const main = mainPool[0] ?? ordered[0]!;
  const mainBlob = normBlob(main.card);

  const rest = sorted.filter((s) => s.card.id !== main.card.id);
  const restOk = rest.filter((s) => !isBackupScenarioConflict(so, mainBlob, normBlob(s.card), s.card));

  /** 보조1: 거리 우선 */
  const nearPool = restOk.length ? restOk : rest;
  nearPool.sort((a, b) => kmOf(a) - kmOf(b) || b.breakdown.finalScore - a.breakdown.finalScore);
  const near = nearPool[0] ?? rest[0];
  if (!near || near.card.id === main.card.id) {
    return sorted.slice(0, limit);
  }

  /** 보조2: 메인·보조1과 다른 카테고리 우선 + 시나리오 점수 */
  const rest2 = rest.filter((s) => s.card.id !== main.card.id && s.card.id !== near.card.id);
  const rest2Ok = rest2.filter((s) => !isBackupScenarioConflict(so, mainBlob, normBlob(s.card), s.card));
  const pool2 = rest2Ok.length ? rest2Ok : rest2;

  const mainCat = catKey(main.card);
  const nearCat = catKey(near.card);
  const scoreAlt = (s: DeckScoredItem) => {
    const c = catKey(s.card);
    let axis = 0;
    if (c && c !== mainCat && c !== nearCat) axis += 22;
    else if (c && c !== mainCat) axis += 12;
    axis += s.breakdown.scenarioRichScore * 0.45 + s.breakdown.qualityScore * 0.35;
    return axis;
  };

  pool2.sort((a, b) => scoreAlt(b) - scoreAlt(a));
  const alt = pool2[0] ?? rest2[0];
  if (!alt) return [main, near].slice(0, limit);

  const out = [main, near, alt].filter(Boolean) as DeckScoredItem[];
  const seen = new Set<string>();
  const uniq = out.filter((x) => {
    if (seen.has(x.card.id)) return false;
    seen.add(x.card.id);
    return true;
  });
  if (uniq.length >= limit) return uniq.slice(0, limit);

  for (const s of sorted) {
    if (uniq.length >= limit) break;
    if (!seen.has(s.card.id)) {
      seen.add(s.card.id);
      uniq.push(s);
    }
  }
  return uniq.slice(0, limit);
}

export function resolveRankKeyOrNeutral(so: ScenarioObject | null | undefined): RecommendScenarioKey | "neutral" {
  const k = rankKeyFromCtx(so);
  return k ?? "neutral";
}
