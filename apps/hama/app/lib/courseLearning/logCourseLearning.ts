import { logEvent } from "@/lib/logEvent";
import type { CourseLearningEventName, CourseLearningLogPayload } from "./courseLearningTypes";

/**
 * 코스 학습용 이벤트 — `logEvent`와 동일 경로로 전송, type 필드는 이벤트명.
 * 서버 `/api/log` → user_actions / analytics 적재 시 스키마 맞추면 됨.
 */
export function logCourseLearningEvent(event: CourseLearningEventName, payload: CourseLearningLogPayload): void {
  logEvent(event, payload as Record<string, unknown>);
}
