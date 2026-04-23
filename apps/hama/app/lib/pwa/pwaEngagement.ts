import { hasPwaEngagement, markPwaEngagement } from "./pwaStorage";

/**
 * 추천·코스 등 의미 있는 화면 진입 시 호출 (설치 안내 자격 +1)
 * 이벤트는 최초 1회만 보내 /results 반복 방문마다 시트가 재스케줄되지 않게 함
 */
export function recordPwaEngagement(): void {
  if (typeof window === "undefined") return;
  const wasEngaged = hasPwaEngagement();
  markPwaEngagement();
  if (!wasEngaged) {
    window.dispatchEvent(new Event("hama-pwa-engaged"));
  }
}
