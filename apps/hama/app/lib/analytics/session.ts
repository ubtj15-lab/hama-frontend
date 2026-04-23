/**
 * HAMA 클라이언트 세션 — @hama/shared와 동기화
 */
import { getOrCreateSessionId as sharedSessionId } from "@hama/shared";

export { getUserId, getOrCreateSessionId } from "@hama/shared";

export function getSessionId(): string {
  return sharedSessionId();
}
