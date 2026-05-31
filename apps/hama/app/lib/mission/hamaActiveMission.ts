export const HAMA_ACTIVE_MISSION_KEY = "hamaActiveMission";

export type HamaActiveMission = {
  placeName: string;
  placeId?: string | number;
  category?: string;
  startedAt: string;
  verified: boolean;
};

export function parseActiveMission(raw: string | null): HamaActiveMission | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<HamaActiveMission>;
    if (typeof parsed.placeName !== "string" || !parsed.placeName.trim()) return null;
    if (typeof parsed.startedAt !== "string" || !parsed.startedAt) return null;
    return {
      placeName: parsed.placeName.trim(),
      placeId: parsed.placeId,
      category: typeof parsed.category === "string" ? parsed.category : undefined,
      startedAt: parsed.startedAt,
      verified: parsed.verified === true,
    };
  } catch {
    return null;
  }
}

export function loadActiveMission(): HamaActiveMission | null {
  if (typeof window === "undefined") return null;
  return parseActiveMission(window.localStorage.getItem(HAMA_ACTIVE_MISSION_KEY));
}

export function saveActiveMission(mission: HamaActiveMission): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HAMA_ACTIVE_MISSION_KEY, JSON.stringify(mission));
  } catch {
    /* ignore */
  }
}

export function createMissionFromPlace(params: {
  placeName: string;
  placeId?: string | number;
  category?: string;
}): HamaActiveMission {
  return {
    placeName: params.placeName,
    placeId: params.placeId,
    category: params.category,
    startedAt: new Date().toISOString(),
    verified: false,
  };
}

/** 영수증 인증 전용 페이지 — 추후 업로드 UI로 확장 예정 */
export const RECEIPT_VERIFY_PATH = "/receipt";
