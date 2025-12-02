// app/lib/logEvent.ts
export type HamaLogType =
  | "page_view"
  | "voice_success"
  | "voice_error"
  | "voice_unsupported"
  | "mic_click"
  | "search"
  | "recommend_click"
  | "navigate"
  | "session_start"
  | "login_start"
  | "logout"
  | "error"
  | "custom"
  | "feedback"; // ✅ 이 줄 추가

export async function logEvent(type: HamaLogType, data: any = {}) {
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        data,
        ts: Date.now(),
      }),
      keepalive: true,
    });
  } catch (e) {
    console.warn("로그 전송 실패:", e);
  }
}
