const STORAGE_KEY = "hama_home_screen_resume_v1";

export type HomeResume = {
  turnId: string;
  text: string;
  scrollTop: number;
  opened: Record<string, boolean>;
  selected: Record<string, number>;
};

type StoredResume = HomeResume & {
  returnPending: boolean;
};

let arrivedByBack = false;
let listening = false;

function rememberBackNavigation() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(
    "popstate",
    () => {
      arrivedByBack = true;
    },
    true
  );
}

rememberBackNavigation();

function readSelected(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const selected: Record<string, number> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "number" && Number.isFinite(item) && item >= 0) selected[key] = Math.floor(item);
  }
  return selected;
}

function readStored(): StoredResume | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredResume;
    if (!parsed || typeof parsed.turnId !== "string" || typeof parsed.text !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function armHomeReturn(resume: HomeResume): void {
  rememberBackNavigation();
  if (typeof window === "undefined") return;
  const stored: StoredResume = {
    turnId: resume.turnId,
    text: resume.text,
    scrollTop: Number.isFinite(resume.scrollTop) ? resume.scrollTop : 0,
    opened: resume.opened ?? {},
    selected: readSelected(resume.selected),
    returnPending: true,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* ignore quota */
  }
}

export function consumeHomeReturn(): HomeResume | null {
  rememberBackNavigation();
  const viaBack = arrivedByBack;
  arrivedByBack = false;
  if (!viaBack) return null;
  const stored = readStored();
  if (!stored?.returnPending) return null;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, returnPending: false }));
  } catch {
    /* ignore quota */
  }
  return {
    turnId: stored.turnId,
    text: stored.text,
    scrollTop: Number.isFinite(stored.scrollTop) ? stored.scrollTop : 0,
    opened: stored.opened && typeof stored.opened === "object" ? stored.opened : {},
    selected: readSelected(stored.selected),
  };
}

export function clearHomeResume(): void {
  arrivedByBack = false;
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
