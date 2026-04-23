/**
 * 코스 예약·실행 QA 수동 시나리오.
 */
export const COURSE_RESERVATION_TEST_SCENARIOS: readonly string[] = [
  "결과 덱: 1단계 식당 코스 → 슬롯 문구 → [이 코스 예약하고 시작하기] → /course?intent=reserve → 게이트/예약",
  "결과 덱: [코스만 보기] → /course (intent 없음) → 상단 예약 블록·실행 상태",
  "예약 완료 → 코스 일정·첫 장소 길찾기·코스 계속 보기 → course 상세에서 실행 상태·예약 id",
  "코스 상세 → syncCourseRunOnCoursePageEntry → phase active·진행 바 → /course/progress",
  "진행 화면: 지금/다음·이동 분·길찾기·다음 장소 보기 → completed",
  "카페/액티비티 첫 단계: [코스만 보기]+길찾기만 (예약 CTA 없음)",
];
