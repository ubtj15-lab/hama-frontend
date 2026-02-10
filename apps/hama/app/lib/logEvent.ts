// app/lib/logEvent.ts

import { getUserId } from "@/_lib/userIdentity";
import { getOrCreateSessionId } from "@/_lib/sessionId";

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
    const userId = getUserId();
    const sessionId = getOrCreateSessionId();
    const isLoggedIn = userId.startsWith("user_");
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: isLoggedIn ? userId : null,
        session_id: sessionId || "unknown",
        type: event,
        data: payload,
      }),
    }).catch(() => {});
  } catch {
    // logging 실패해도 앱은 죽으면 안 됨
  }
}
