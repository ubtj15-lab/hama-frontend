// app/lib/logEvent.ts

type LogPayload = Record<string, unknown>;

export function logEvent(event: string, payload: LogPayload = {}) {
  // 서버/빌드 환경에서 window 없을 수 있으니 방어
  if (typeof window === "undefined") return;

  try {
    // 개발 중 확인용: 필요하면 콘솔로만 남기기
    // console.log("[logEvent]", event, payload);

    // 나중에 Supabase/GA/Amplitude 붙일 때 여기만 바꾸면 됨
    (window as any).__HAMA_LOGS__ = (window as any).__HAMA_LOGS__ || [];
    (window as any).__HAMA_LOGS__.push({
      event,
      payload,
      ts: Date.now(),
    });
  } catch {
    // logging 실패해도 앱은 죽으면 안 됨
  }
}
