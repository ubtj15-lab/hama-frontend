/**
 * Course Repeat V1 — session-local, context-keyed, deterministic soft-avoid.
 * Does not change ranking weights, Course Time, or add randomness.
 */

export type CourseRepeatAvoidance = {
  placeIds: string[];
  orderedSignatures: string[];
  unorderedSignatures: string[];
};

export const EMPTY_COURSE_REPEAT_AVOIDANCE: CourseRepeatAvoidance = {
  placeIds: [],
  orderedSignatures: [],
  unorderedSignatures: [],
};

export const COURSE_REFRESH_BUTTON_COPY = "다른 코스 보기";

export function shouldShowCourseRefreshButton(
  showCourseDeck: boolean,
  coursePlanCount: number
): boolean {
  return Boolean(showCourseDeck) && coursePlanCount > 0;
}

/** Actual Course refresh click: re-read session exposure. Does not clear storage. */
export function applyCourseRefreshClick(contextKey: string): {
  courseRepeatAvoid: CourseRepeatAvoidance;
  nextRefreshVersion: (current: number) => number;
} {
  return {
    courseRepeatAvoid: readCourseRepeatAvoidance(contextKey),
    nextRefreshVersion: (current) => current + 1,
  };
}

const COURSE_REPEAT_STORAGE_KEY = "hama_course_repeat_v1";
const MAX_PLACE_IDS = 80;
const MAX_SIGNATURES = 30;

export function courseRepeatContextKey(query: string, scenario?: string | null): string {
  const q = String(query ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 80);
  const sc = String(scenario ?? "")
    .trim()
    .toLowerCase();
  return `course|${sc}|${q}`;
}

export function orderedCourseSignature(placeIds: readonly string[]): string {
  return placeIds.map((id) => String(id ?? "").trim()).filter(Boolean).join(">");
}

export function unorderedCourseSignature(placeIds: readonly string[]): string {
  return [...new Set(placeIds.map((id) => String(id ?? "").trim()).filter(Boolean))].sort().join("|");
}

export function courseRepeatsDisplayed(
  placeIds: readonly string[],
  avoid: CourseRepeatAvoidance | null | undefined
): boolean {
  if (!avoid) return false;
  const ids = placeIds.map((id) => String(id ?? "").trim()).filter(Boolean);
  if (ids.length === 0) return false;
  const ordered = orderedCourseSignature(ids);
  if (ordered && avoid.orderedSignatures.includes(ordered)) return true;
  const unordered = unorderedCourseSignature(ids);
  return Boolean(unordered && avoid.unorderedSignatures.includes(unordered));
}

/** Same score: unseen before seen. Never promote a worse score. Stable among equal seen-ness. */
export function compareEqualScoreUnseenFirst(
  aScore: number,
  aId: string,
  bScore: number,
  bId: string,
  seenIds: ReadonlySet<string>
): number {
  if (bScore !== aScore) return bScore - aScore;
  const aSeen = seenIds.has(String(aId ?? "").trim()) ? 1 : 0;
  const bSeen = seenIds.has(String(bId ?? "").trim()) ? 1 : 0;
  return aSeen - bSeen;
}

export function hasCourseRepeatAvoidance(avoid: CourseRepeatAvoidance | null | undefined): boolean {
  if (!avoid) return false;
  return (
    avoid.placeIds.length > 0 ||
    avoid.orderedSignatures.length > 0 ||
    avoid.unorderedSignatures.length > 0
  );
}

export type CourseDeckCandidate<T> = {
  item: T;
  placeIds: readonly string[];
  score: number;
  key: string;
};

/**
 * Deck-wide Course Repeat: fill all visible slots from unseen signatures first.
 * Score order among unseen is preserved. Same-deck reorder is skipped while
 * a different valid plan exists. Previously shown plans are fallback only.
 */
export function selectCourseDeckAvoidingRepeat<T>(
  candidates: readonly CourseDeckCandidate<T>[],
  avoid: CourseRepeatAvoidance | null | undefined,
  preferredUnseen: readonly T[] | null,
  limit = 3
): T[] {
  if (candidates.length === 0 || limit <= 0) return [];
  if (!hasCourseRepeatAvoidance(avoid)) {
    return (preferredUnseen ?? candidates.map((c) => c.item)).slice(0, limit);
  }

  const byItem = new Map<T, CourseDeckCandidate<T>>();
  for (const c of candidates) {
    if (!byItem.has(c.item)) byItem.set(c.item, c);
  }
  const unseen = candidates
    .filter((c) => !courseRepeatsDisplayed(c.placeIds, avoid))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const seen = candidates
    .filter((c) => courseRepeatsDisplayed(c.placeIds, avoid))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

  const picked: T[] = [];
  const usedKeys = new Set<string>();
  const usedOrdered = new Set<string>();
  const usedUnordered = new Set<string>();

  const tryAdd = (item: T, allowSameDeckSignature: boolean): boolean => {
    const c = byItem.get(item);
    if (!c || usedKeys.has(c.key)) return false;
    const ordered = orderedCourseSignature(c.placeIds);
    const unordered = unorderedCourseSignature(c.placeIds);
    if (!allowSameDeckSignature) {
      if (ordered && usedOrdered.has(ordered)) return false;
      if (unordered && usedUnordered.has(unordered)) return false;
    }
    picked.push(item);
    usedKeys.add(c.key);
    if (ordered) usedOrdered.add(ordered);
    if (unordered) usedUnordered.add(unordered);
    return true;
  };

  if (preferredUnseen) {
    for (const item of preferredUnseen) {
      if (picked.length >= limit) break;
      const c = byItem.get(item);
      if (!c || courseRepeatsDisplayed(c.placeIds, avoid)) continue;
      tryAdd(item, false);
    }
  }
  for (const c of unseen) {
    if (picked.length >= limit) break;
    tryAdd(c.item, false);
  }
  for (const c of seen) {
    if (picked.length >= limit) break;
    tryAdd(c.item, false);
  }
  if (picked.length < limit) {
    const rest = [...candidates].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    for (const c of rest) {
      if (picked.length >= limit) break;
      tryAdd(c.item, true);
    }
  }
  return picked.slice(0, limit);
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function normalizeAvoidance(raw: unknown): CourseRepeatAvoidance {
  if (!raw || typeof raw !== "object") return { ...EMPTY_COURSE_REPEAT_AVOIDANCE };
  const o = raw as Partial<CourseRepeatAvoidance>;
  const clean = (arr: unknown, cap: number) =>
    (Array.isArray(arr) ? arr : [])
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, cap);
  return {
    placeIds: [...new Set(clean(o.placeIds, MAX_PLACE_IDS))],
    orderedSignatures: [...new Set(clean(o.orderedSignatures, MAX_SIGNATURES))],
    unorderedSignatures: [...new Set(clean(o.unorderedSignatures, MAX_SIGNATURES))],
  };
}

function readAllMap(): Record<string, CourseRepeatAvoidance> {
  const ss = getSessionStorage();
  if (!ss) return {};
  try {
    const parsed = JSON.parse(ss.getItem(COURSE_REPEAT_STORAGE_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, CourseRepeatAvoidance> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!k.startsWith("course|")) continue;
      out[k] = normalizeAvoidance(v);
    }
    return out;
  } catch {
    return {};
  }
}

export function readCourseRepeatAvoidance(contextKey: string): CourseRepeatAvoidance {
  const key = String(contextKey ?? "").trim();
  if (!key) return { ...EMPTY_COURSE_REPEAT_AVOIDANCE };
  return normalizeAvoidance(readAllMap()[key]);
}

export function recordDisplayedCoursePlans(
  contextKey: string,
  plans: readonly { stops?: readonly { placeId?: string }[] }[]
): CourseRepeatAvoidance {
  const key = String(contextKey ?? "").trim();
  if (!key) return { ...EMPTY_COURSE_REPEAT_AVOIDANCE };
  const prev = readCourseRepeatAvoidance(key);
  const placeIds = [...prev.placeIds];
  const orderedSignatures = [...prev.orderedSignatures];
  const unorderedSignatures = [...prev.unorderedSignatures];
  const placeSet = new Set(placeIds);
  const orderedSet = new Set(orderedSignatures);
  const unorderedSet = new Set(unorderedSignatures);

  for (const plan of plans) {
    const ids = (plan.stops ?? []).map((s) => String(s.placeId ?? "").trim()).filter(Boolean);
    if (ids.length === 0) continue;
    const ordered = orderedCourseSignature(ids);
    const unordered = unorderedCourseSignature(ids);
    if (ordered && !orderedSet.has(ordered) && orderedSignatures.length < MAX_SIGNATURES) {
      orderedSet.add(ordered);
      orderedSignatures.push(ordered);
    }
    if (unordered && !unorderedSet.has(unordered) && unorderedSignatures.length < MAX_SIGNATURES) {
      unorderedSet.add(unordered);
      unorderedSignatures.push(unordered);
    }
    for (const id of ids) {
      if (placeSet.has(id) || placeIds.length >= MAX_PLACE_IDS) continue;
      placeSet.add(id);
      placeIds.push(id);
    }
  }

  const next: CourseRepeatAvoidance = { placeIds, orderedSignatures, unorderedSignatures };
  const ss = getSessionStorage();
  if (ss) {
    try {
      const map = readAllMap();
      map[key] = next;
      ss.setItem(COURSE_REPEAT_STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* session full / private mode */
    }
  }
  return next;
}
