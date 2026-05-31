/**
 * Supabase stores row → HomeCard 태그 어댑터 (추천 랭킹/게이트와 분리).
 * 흩어진 태그·키워드·설명 필드를 읽어 tags / normalizedTags로 합칩니다.
 */

import { hamaDevLog } from "@/lib/hamaDevLog";

/** row에서 읽을 후보 필드 (순서 = 우선 병합 순서) */
export const STORE_TAG_SOURCE_KEYS = [
  "tags",
  "tag",
  "keywords",
  "keyword",
  "labels",
  "label",
  "category_tags",
  "recommendation_tags",
  "mood_tags",
  "use_case_tags",
  "raw_tags",
  "description",
  "memo",
  "metadata",
] as const;

const TAG_SPLIT_RE = /[,，/|#]+|\s+/;

const MAX_NORMALIZED_TAGS = 20;

let debugLogCount = 0;
const MAX_TAG_DEBUG_LOGS = 3;

export type StoreTagNormalizeResult = {
  tags: string[];
  normalizedTags: string[];
  rawTagFields: Record<string, unknown>;
};

function splitTagString(raw: string): string[] {
  return raw
    .split(TAG_SPLIT_RE)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t !== "#");
}

function pushTagToken(token: string, bucket: string[]): void {
  const t = token.trim();
  if (!t) return;
  if (t.length > 80) return;
  bucket.push(t);
}

function collectFromUnknown(value: unknown, bucket: string[]): void {
  if (value == null) return;
  if (typeof value === "string") {
    for (const part of splitTagString(value)) pushTagToken(part, bucket);
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    pushTagToken(String(value), bucket);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectFromUnknown(item, bucket);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectFromUnknown(v, bucket);
    }
  }
}

function readField(row: Record<string, unknown>, key: string): unknown {
  if (key in row) return row[key];
  const snake = key.replace(/([A-Z])/g, "_$1").toLowerCase();
  if (snake in row) return row[snake];
  return undefined;
}

function dedupeTagsPreserveOrder(tokens: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_NORMALIZED_TAGS) break;
  }
  return out;
}

/**
 * DB row + 기존 tags를 합쳐 정규화된 태그 배열을 만듭니다. 기존 tags는 덮어쓰지 않습니다.
 */
export function normalizeStoreTagsFromRow(
  row: Record<string, unknown>,
  options?: { existingTags?: string[] | null; name?: string | null }
): StoreTagNormalizeResult {
  const rawTagFields: Record<string, unknown> = {};
  const collected: string[] = [];

  const existing = Array.isArray(options?.existingTags) ? options!.existingTags! : [];
  for (const t of existing) collectFromUnknown(t, collected);

  for (const key of STORE_TAG_SOURCE_KEYS) {
    const value = readField(row, key);
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    rawTagFields[key] = value;
    collectFromUnknown(value, collected);
  }

  const normalizedTags = dedupeTagsPreserveOrder(collected);

  const name = String(options?.name ?? readField(row, "name") ?? "").trim();
  if (debugLogCount < MAX_TAG_DEBUG_LOGS && name) {
    debugLogCount += 1;
    hamaDevLog("[HAMA_TAG_NORMALIZE_DEBUG]", {
      name,
      rawTagFields,
      normalizedTags,
    });
  }

  return {
    tags: normalizedTags,
    normalizedTags,
    rawTagFields,
  };
}

/** 테스트/디버그용 카운터 초기화 */
export function resetStoreTagNormalizeDebugCount(): void {
  debugLogCount = 0;
}
