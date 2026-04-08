const STORAGE_KEY = "hama_recent_intents";
const MAX = 8;

export function recordRecentIntent(query: string): void {
  const q = String(query ?? "").trim();
  if (q.length < 2) return;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const prev: string[] = raw ? JSON.parse(raw) : [];
    const next = [q, ...prev.filter((x) => x !== q)].slice(0, MAX);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function readRecentIntents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
