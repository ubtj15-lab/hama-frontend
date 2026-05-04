// app/lib/logEvent.ts

import { getDbUserId, getOrCreateSessionId as getLegacySessionId } from "@hama/shared";

type LogPayload = Record<string, unknown>;

const HAMA_EVENT_SESSION_KEY = "hama_session_id";

/**
 * Session-scoped id for `hama_events` (sessionStorage, per product spec).
 * Differs from `@hama/shared` which uses localStorage for legacy `/api/log`.
 */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.sessionStorage.getItem(HAMA_EVENT_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(HAMA_EVENT_SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export type HamaEventInput = {
  event_name: string;
  session_id?: string | null;
  user_id?: string | null;
  query?: string | null;
  intent?: string | null;
  category?: string | null;
  mode?: string | null;
  source?: string | null;
  place_id?: string | null;
  place_name?: string | null;
  place_category?: string | null;
  rank_position?: number | null;
  action?: string | null;
  situation_tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Fire-and-forget insert into `hama_events` via POST /api/events. Never throws.
 */
export function logHamaEvent(input: HamaEventInput): void {
  if (typeof window === "undefined") return;
  if (!input?.event_name) return;

  try {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[hama event]", input);
    }

    const session_id = getOrCreateSessionId();
    const user_id = getDbUserId();
    const body: HamaEventInput = {
      ...input,
      session_id: input.session_id ?? session_id,
      user_id: input.user_id ?? user_id,
    };

    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => res.json().catch(() => ({})))
      .then((json: { ok?: boolean }) => {
        if (json && json.ok === false) {
          console.warn("[hama event] server returned ok: false", input.event_name);
        }
      })
      .catch((e) => {
        console.warn("[hama event] fetch failed", input.event_name, e);
      });
  } catch (e) {
    console.warn("[hama event] unexpected", e);
  }
}

export function logEvent(event: string, payload: LogPayload = {}) {
  if (typeof window === "undefined") return;

  try {
    (window as unknown as { __HAMA_LOGS__?: unknown[] }).__HAMA_LOGS__ =
      (window as unknown as { __HAMA_LOGS__?: unknown[] }).__HAMA_LOGS__ || [];
    (window as unknown as { __HAMA_LOGS__: unknown[] }).__HAMA_LOGS__.push({
      event,
      payload,
      ts: Date.now(),
    });

    const sessionId = getLegacySessionId();
    const userId = getDbUserId();
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId || "unknown",
        type: event,
        data: payload,
      }),
    }).catch((e) => console.error("logEvent fetch failed:", e));
  } catch (e) {
    console.error("logEvent failed:", e);
  }
}
