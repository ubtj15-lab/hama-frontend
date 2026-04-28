/**
 * 예약 UX — 더미/확장용 타입.
 * 실제 결제·재고 연동 시 API 응답 스키마로 교체 가능.
 */

export type DepositPolicyKind = "none" | "deduct_at_visit" | "partial_no_show";

export type ReservationPreview = {
  /** 오늘 온라인 예약 슬롯이 있다고 가정 (더미) */
  availableToday: boolean;
  /** 노출할 시간 슬롯 라벨 (예: 18:00) */
  slotLabels: string[];
  /** 오늘 슬롯이 없을 때 대체 노출 */
  tomorrowSlotLabels?: string[];
  /** 원 단위. null이면 예약금 없음 */
  depositWon: number | null;
  policy: DepositPolicyKind;
  /** 예약금이 있을 때 부가 설명 */
  depositCaption: string;
  /** 노쇼 안내 (부드러운 톤) */
  noShowSoftNote: string;
  /** 프리미엄 혜택(예약금 면제 등) UI 확장용 — 현재는 표시만 */
  premiumPerks?: {
    label: string;
    /** true면 배지·문구 노출, CTA는 비활성/준비중 가능 */
    depositWaiverAvailable: boolean;
  };
};

export type ReservationFlowState = {
  party: number;
  timeLabel: string;
  dateLabel: string;
};
