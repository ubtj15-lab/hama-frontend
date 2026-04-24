// app/lib/logEvent.ts

import { getDbUserId, getOrCreateSessionId } from "@hama/shared";

type LogPayload = Record<string, unknown>;

export function logEvent(event: string, payload: LogPayload = {}) {
  // 서버/빌드 환경에서 window 없을 수 있으니 방어
  if (typeof window === "undefined") return;

  try {
    (window as any).__HAMA_LOGS__ = (window as any).__HAMA_LOGS__ || [];
    (window as any).__HAMA_LOGS__.push({
      event,
      payload,
      ts: Date.now(),
    });

    // Supabase events 테이블로 전송 (fire-and-forget)
    const sessionId = getOrCreateSessionId();
    const userId = getDbUserId();
    // TODO(Supabase): user_actions 테이블(또는 analytics.events)로 정식 적재 시 payload 스키마 맞추기
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
    // logging 실패해도 앱은 죽으면 안 됨
  }
}
