"use client";

/** 세션당 1회 생성 — search-by-name 다양성 시드용 (x-hama-search-seed) */
export function getOrCreateHamaSearchSeed(): string {
  if (typeof window === "undefined") return "";
  try {
    const k = "hama_search_seed";
    let v = sessionStorage.getItem(k);
    if (!v) {
      v =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "";
  }
}

/** recent exposure ids for search-by-name header */
export function getRecentExposedIdsHeaderValue(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = sessionStorage.getItem("hama_recent_exposed_store_ids");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return "";
    const ids = parsed
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, 10);
    return ids.join(",");
  } catch {
    return "";
  }
}

export function getRecentExposedNamesHeaderValue(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = sessionStorage.getItem("hama_recent_exposed_store_names");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return "";
    const names = parsed
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, 10);
    return names.join(",");
  } catch {
    return "";
  }
}
