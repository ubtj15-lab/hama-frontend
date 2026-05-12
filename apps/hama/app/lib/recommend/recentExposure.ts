"use client";

import type { HomeCard } from "@/lib/storeTypes";

const RECENT_EXPOSED_KEY = "hama_recent_exposed_store_ids";
const RECENT_EXPOSED_NAMES_KEY = "hama_recent_exposed_store_names";
/** Session memory for deprioritizing repeat recommendations (30–50 ids). */
const RECENT_EXPOSED_MAX = 50;

const SEARCH_ATTEMPT_MAP_KEY = "hama_search_attempt_by_query_v1";
const NF_PREV_TOP3_MAP_KEY = "hama_nf_prev_top3_fp_v1";
const NF_TOP1_STREAK_MAP_KEY = "hama_nf_top1_streak_v1";

/** 정규화된 쿼리 키 — 검색 회차·노출 키에 공통 사용 */
export function normExposureQueryKey(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getCardExposureId(card: HomeCard): string {
  const c = card as { place_id?: string | null; store_id?: string | null; id?: string | null };
  return String(c.place_id ?? c.store_id ?? c.id ?? "").trim();
}

export function readRecentExposedStoreIds(): string[] {
  const ss = getSessionStorage();
  if (!ss) return [];
  try {
    const raw = ss.getItem(RECENT_EXPOSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, RECENT_EXPOSED_MAX);
  } catch {
    return [];
  }
}

export function saveRecentExposedStoreIds(exposedIds: string[]): string[] {
  const ss = getSessionStorage();
  if (!ss) return [];
  const latest = exposedIds.map((x) => String(x ?? "").trim()).filter(Boolean);
  const prev = readRecentExposedStoreIds();
  const merged = [...latest, ...prev];
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const id of merged) {
    if (seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
    if (uniq.length >= RECENT_EXPOSED_MAX) break;
  }
  try {
    ss.setItem(RECENT_EXPOSED_KEY, JSON.stringify(uniq));
  } catch {}
  return uniq;
}

export function readRecentExposedStoreNames(): string[] {
  const ss = getSessionStorage();
  if (!ss) return [];
  try {
    const raw = ss.getItem(RECENT_EXPOSED_NAMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, RECENT_EXPOSED_MAX);
  } catch {
    return [];
  }
}

/**
 * 같은 정규화 쿼리로 검색할 때마다 1씩 증가 — 셔플 시드에 넣어 반복 검색 다양성 확보.
 */
export function bumpAndReadSearchAttemptForQuery(rawQuery: string): number {
  const ss = getSessionStorage();
  const k = normExposureQueryKey(rawQuery);
  if (!ss || !k) return 1;
  try {
    const raw = ss.getItem(SEARCH_ATTEMPT_MAP_KEY);
    const map: Record<string, number> =
      raw && typeof raw === "string" ? (JSON.parse(raw) as Record<string, number>) : {};
    const prev = typeof map[k] === "number" && Number.isFinite(map[k]) ? map[k]! : 0;
    const next = prev + 1;
    map[k] = next;
    ss.setItem(SEARCH_ATTEMPT_MAP_KEY, JSON.stringify(map));
    return next;
  } catch {
    return 1;
  }
}

function hashExposureSignature(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * RecommendationList contextKey 등에 넣을 짧은 시그니처 — 최근 노출 id 목록이 바뀌면 값이 바뀐다.
 */
export function getRecentExposureRotationSignature(): string {
  const ids = readRecentExposedStoreIds();
  if (ids.length === 0) return "0";
  const head = ids.slice(0, 12).join("\u001e");
  return `${ids.length}_${hashExposureSignature(head)}`;
}

function nfSessionCompositeKey(rawQuery: string | null | undefined, presetId: string): string {
  return `${normExposureQueryKey(String(rawQuery ?? ""))}|${presetId}`;
}

function readJsonObjectMap(mapKey: string): Record<string, unknown> {
  const ss = getSessionStorage();
  if (!ss) return {};
  try {
    const raw = ss.getItem(mapKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeJsonObjectMap(mapKey: string, data: Record<string, unknown>): void {
  const ss = getSessionStorage();
  if (!ss) return;
  try {
    ss.setItem(mapKey, JSON.stringify(data));
  } catch {}
}

export function readNamedFoodPrevTop3Fingerprint(
  rawQuery: string | null | undefined,
  presetId: string
): string | null {
  const ck = nfSessionCompositeKey(rawQuery, presetId);
  const m = readJsonObjectMap(NF_PREV_TOP3_MAP_KEY);
  const v = m[ck];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function writeNamedFoodPrevTop3Fingerprint(
  rawQuery: string | null | undefined,
  presetId: string,
  fingerprint: string
): void {
  const ck = nfSessionCompositeKey(rawQuery, presetId);
  const m = readJsonObjectMap(NF_PREV_TOP3_MAP_KEY);
  m[ck] = fingerprint;
  writeJsonObjectMap(NF_PREV_TOP3_MAP_KEY, m);
}

export type NamedFoodTop1StreakState = { lastId: string; streak: number };

export function readNamedFoodTop1Streak(
  rawQuery: string | null | undefined,
  presetId: string
): NamedFoodTop1StreakState | null {
  const ck = nfSessionCompositeKey(rawQuery, presetId);
  const m = readJsonObjectMap(NF_TOP1_STREAK_MAP_KEY);
  const v = m[ck];
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const lastId = typeof o.lastId === "string" ? o.lastId : "";
  const streak = typeof o.streak === "number" && Number.isFinite(o.streak) ? Math.max(0, Math.floor(o.streak)) : 0;
  if (!lastId) return null;
  return { lastId, streak };
}

export function writeNamedFoodTop1Streak(
  rawQuery: string | null | undefined,
  presetId: string,
  state: NamedFoodTop1StreakState
): void {
  const ck = nfSessionCompositeKey(rawQuery, presetId);
  const m = readJsonObjectMap(NF_TOP1_STREAK_MAP_KEY);
  m[ck] = state;
  writeJsonObjectMap(NF_TOP1_STREAK_MAP_KEY, m);
}

/** 직전에 확정된 덱의 1위 exposure id와 같은 id가 세 번째 연속 1위가 되지 않도록, 회차 커밋용 */
export function commitNamedFoodTop1Streak(
  rawQuery: string | null | undefined,
  presetId: string,
  deck: readonly { card: HomeCard }[]
): void {
  if (deck.length === 0) return;
  const topExp = String(getCardExposureId(deck[0]!.card) || deck[0]!.card.id || "").trim();
  if (!topExp) return;
  const prev = readNamedFoodTop1Streak(rawQuery, presetId);
  const streak = prev != null && prev.lastId === topExp ? prev.streak + 1 : 1;
  writeNamedFoodTop1Streak(rawQuery, presetId, { lastId: topExp, streak });
}

export function saveRecentExposedStoreNames(exposedNames: string[]): string[] {
  const ss = getSessionStorage();
  if (!ss) return [];
  const latest = exposedNames.map((x) => String(x ?? "").trim()).filter(Boolean);
  const prev = readRecentExposedStoreNames();
  const merged = [...latest, ...prev];
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const name of merged) {
    if (seen.has(name)) continue;
    seen.add(name);
    uniq.push(name);
    if (uniq.length >= RECENT_EXPOSED_MAX) break;
  }
  try {
    ss.setItem(RECENT_EXPOSED_NAMES_KEY, JSON.stringify(uniq));
  } catch {}
  return uniq;
}
