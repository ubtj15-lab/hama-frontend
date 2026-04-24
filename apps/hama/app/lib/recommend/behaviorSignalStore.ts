/**
 * 클라이언트 추천 행동 신호 — 로컬 스토리지 (user_id 우선, 없으면 session_id).
 * 서버 SSR/노드 테스트에서는 읽기 전용 기본값.
 */
import { getDbUserId, getOrCreateSessionId } from "@/lib/analytics/session";

const STORAGE_KEY_PREFIX = "hama_reco_behavior_v1";
const MAX_TAGS = 24;
const MAX_SCENARIO_HISTORY = 8;

export type BehaviorStoreV1 = {
  v: 1;
  impressionCount: number;
  /** placeId → 누적 raw boost (이벤트 가중 합) */
  places: Record<string, number>;
  preferredTags: string[];
  avoidTags: string[];
  preferredScenarios: string[];
};

const emptyStore = (): BehaviorStoreV1 => ({
  v: 1,
  impressionCount: 0,
  places: {},
  preferredTags: [],
  avoidTags: [],
  preferredScenarios: [],
});

function storageKey(): string {
  const uid = typeof window !== "undefined" ? getDbUserId() : null;
  const sid = typeof window !== "undefined" ? getOrCreateSessionId() : "server";
  const actor = uid ? `u:${uid}` : `s:${sid}`;
  return `${STORAGE_KEY_PREFIX}:${actor}`;
}

function readStore(): BehaviorStoreV1 {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return emptyStore();
    const j = JSON.parse(raw) as Partial<BehaviorStoreV1>;
    if (j?.v !== 1) return emptyStore();
    return {
      v: 1,
      impressionCount: Math.max(0, Number(j.impressionCount) || 0),
      places: typeof j.places === "object" && j.places ? j.places : {},
      preferredTags: Array.isArray(j.preferredTags) ? j.preferredTags.map(String) : [],
      avoidTags: Array.isArray(j.avoidTags) ? j.avoidTags.map(String) : [],
      preferredScenarios: Array.isArray(j.preferredScenarios) ? j.preferredScenarios.map(String) : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(s: BehaviorStoreV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(s));
  } catch {
    /* quota / private mode */
  }
}

function pushCap(list: string[], add: string[], cap: number): string[] {
  const out = [...list];
  for (const a of add) {
    const t = a.trim().toLowerCase();
    if (t.length < 2) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(-cap);
}

function tagsFromCardMeta(meta: Record<string, unknown> | undefined): string[] {
  if (!meta) return [];
  const snap = meta.place_snapshot as Record<string, unknown> | undefined;
  const parts: string[] = [];
  if (snap?.category) parts.push(String(snap.category));
  if (snap?.name) parts.push(String(snap.name));
  return parts;
}

/** @see learnedBoostModel.ts — raw 가중치 */
export const BEHAVIOR_EVENT_RAW_WEIGHT: Record<string, number> = {
  place_impression: 0,
  place_click: 1,
  decision_complete: 3,
  course_start: 5,
  reservation_complete: 6,
  positive_feedback: 7,
  negative_feedback: -5,
  quick_exit: -3,
};

function addPlaceRaw(s: BehaviorStoreV1, placeId: string, delta: number): void {
  if (!placeId || !Number.isFinite(delta) || delta === 0) return;
  s.places[placeId] = (s.places[placeId] ?? 0) + delta;
}

/**
 * recommendation_events 와 동기화되는 클라이언트 학습 버퍼.
 */
export function recordBehaviorFromRecommendationEvent(input: {
  event_name: string;
  entity_type?: string | null;
  entity_id?: string | null;
  place_ids?: string[];
  scenario?: string | null;
  metadata?: Record<string, unknown> | null;
}): void {
  if (typeof window === "undefined") return;
  const name = input.event_name;
  const s = readStore();

  if (name === "place_impression") {
    s.impressionCount += 1;
  }

  if (name === "positive_feedback") {
    const id = input.entity_id ?? input.place_ids?.[0];
    if (id) addPlaceRaw(s, String(id), BEHAVIOR_EVENT_RAW_WEIGHT.positive_feedback);
  } else if (name === "negative_feedback") {
    const id = input.entity_id ?? input.place_ids?.[0];
    if (id) addPlaceRaw(s, String(id), BEHAVIOR_EVENT_RAW_WEIGHT.negative_feedback);
    const tag = input.metadata && String((input.metadata as any).avoid_tag ?? "").trim();
    if (tag) s.avoidTags = pushCap(s.avoidTags, [tag], MAX_TAGS);
  } else if (name === "quick_exit") {
    const id = input.entity_id ?? input.place_ids?.[0];
    if (id) addPlaceRaw(s, String(id), BEHAVIOR_EVENT_RAW_WEIGHT.quick_exit);
  } else if (name === "place_feedback" && input.metadata) {
    const sentiment = String((input.metadata as any).sentiment ?? "").trim();
    const id = input.entity_id && input.entity_id !== "unknown" ? String(input.entity_id) : "";
    if (sentiment === "positive" && id) addPlaceRaw(s, id, 7);
    else if (sentiment === "negative" && id) addPlaceRaw(s, id, -5);
  }

  const rawW = BEHAVIOR_EVENT_RAW_WEIGHT[name as keyof typeof BEHAVIOR_EVENT_RAW_WEIGHT];
  if (
    typeof rawW === "number" &&
    rawW !== 0 &&
    name !== "positive_feedback" &&
    name !== "negative_feedback" &&
    name !== "quick_exit"
  ) {
    const ids = (input.place_ids?.length ? input.place_ids : input.entity_id ? [input.entity_id] : []).filter(
      Boolean
    ) as string[];
    if (name === "course_start" && ids.length > 1) {
      const per = rawW / ids.length;
      for (const id of ids) addPlaceRaw(s, id, per);
    } else {
      for (const id of ids) addPlaceRaw(s, id, rawW);
    }
  }

  if (input.scenario && name !== "place_impression") {
    s.preferredScenarios = pushCap(s.preferredScenarios, [String(input.scenario)], MAX_SCENARIO_HISTORY);
  }

  if (name === "place_click" && input.metadata) {
    s.preferredTags = pushCap(s.preferredTags, tagsFromCardMeta(input.metadata), MAX_TAGS);
  }

  writeStore(s);
}

export function getGlobalImpressionCount(): number {
  return readStore().impressionCount;
}

export function getPlaceBehaviorRaw(placeId: string): number {
  return readStore().places[placeId] ?? 0;
}

export function getPersonalizationHints(): Pick<BehaviorStoreV1, "preferredTags" | "avoidTags" | "preferredScenarios"> {
  const r = readStore();
  return {
    preferredTags: r.preferredTags,
    avoidTags: r.avoidTags,
    preferredScenarios: r.preferredScenarios,
  };
}
