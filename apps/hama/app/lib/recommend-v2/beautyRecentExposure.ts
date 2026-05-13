import type { HomeCard } from "@/lib/storeTypes";

const HAMA_BEAUTY_RECENT_EXPOSURE_KEY = "hamaBeautyRecentExposure";
const STORAGE_CAP = 32;
/** 최근 이 개수만큼의 id는 후보 풀에서 우선 제외 */
export const BEAUTY_V2_EXPOSURE_EXCLUDE_COUNT = 10;

export function beautyExposureId(card: HomeCard): string {
  const c = card as { place_id?: string | null; store_id?: string | null; id?: string | null };
  return String(c.place_id ?? c.store_id ?? c.id ?? "").trim();
}

export function readBeautyRecentExposureIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HAMA_BEAUTY_RECENT_EXPOSURE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, STORAGE_CAP);
  } catch {
    return [];
  }
}

/** 최근 노출 순(앞이 최신). `ids`는 이번에 화면에보낸 덱 id */
export function recordBeautyRecentExposureIds(ids: string[]): void {
  if (typeof window === "undefined" || ids.length === 0) return;
  try {
    const fresh = ids.map((x) => String(x ?? "").trim()).filter(Boolean);
    const prev = readBeautyRecentExposureIds();
    const merged = [...fresh, ...prev];
    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const id of merged) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      uniq.push(id);
      if (uniq.length >= STORAGE_CAP) break;
    }
    localStorage.setItem(HAMA_BEAUTY_RECENT_EXPOSURE_KEY, JSON.stringify(uniq));
  } catch {
    /* ignore quota / private mode */
  }
}
