/**
 * 코스 실행·예약 연결 데이터 모델 (브라우저 sessionStorage + 코스 JSON stash).
 *
 * - `CoursePlan`: 코스 본문 — `stashCoursePlan` / `readCoursePlanWithFallback`
 * - `CourseRunRecord`: 실행 상태(idle→confirmed→active→completed), `reservationId`, `currentStopIndex`
 * - `CourseStepReservationMeta`: 1단계 식당 예약 완료 시각·인원·예약금 플로우와 연결
 *
 * 예약은 1단계(식당)만 연결. `stepIndex`는 1 기준(첫 식당).
 */
export type {
  CourseLifecyclePhase,
  CourseRunRecord,
  CourseStepReservationMeta,
} from "./courseSession";
