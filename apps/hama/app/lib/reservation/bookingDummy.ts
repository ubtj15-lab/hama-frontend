import type { ReservationPreview } from "./bookingTypes";

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SLOT_POOLS = [
  ["17:30", "18:00", "18:30", "19:00", "19:30"],
  ["12:00", "12:30", "13:00", "18:00", "19:00"],
  ["11:30", "12:00", "18:00", "18:30", "20:00"],
];

function hmToMinutes(s: string): number {
  const [hh, mm] = s.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return -1;
  return hh * 60 + mm;
}

/**
 * 매장별 결정적 더미 예약 미리보기.
 * storeId + category로 슬롯·예약금 패턴이 달라짐.
 */
export function getReservationPreviewForStore(storeId: string, category: string | null): ReservationPreview {
  const h = hash32(`${storeId}:${category ?? ""}`);
  const pool = SLOT_POOLS[h % SLOT_POOLS.length]!;
  const start = h % Math.max(1, pool.length - 2);
  const rawSlots = pool.slice(start, start + 3);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const slotLabels = rawSlots.filter((t) => hmToMinutes(t) > currentMinutes);
  const tomorrowSlotLabels = rawSlots;

  const depositRoll = h % 10;
  const hasDeposit = depositRoll >= 4;
  const depositWon = hasDeposit ? [5000, 10000, 15000][h % 3]! : null;

  const policy = !hasDeposit ? "none" : h % 2 === 0 ? "deduct_at_visit" : "partial_no_show";

  const depositCaption =
    depositWon != null
      ? "방문 시 식사 금액에서 전액 차감돼요. 노쇼 방지용 보증금이에요."
      : "예약금 없이 바로 잡을 수 있어요.";

  const noShowSoftNote =
    policy === "partial_no_show"
      ? "예약 후 노쇼가 반복되면 일부가 정산에서 차감될 수 있어요. 꼭 방문이 어려우면 미리 연락해 주세요."
      : "일정이 바뀌면 전화로 미리 알려주면 돼요.";

  return {
    availableToday: slotLabels.length > 0,
    slotLabels,
    tomorrowSlotLabels,
    depositWon,
    policy,
    depositCaption,
    noShowSoftNote,
    premiumPerks: {
      label: "프리미엄 멤버는 예약금 면제 혜택을 받을 수 있어요",
      depositWaiverAvailable: hasDeposit,
    },
  };
}

/** 코스 첫 정류장이 식사 중심(예약 유도)인지 — FOOD + meal/light */
export function courseFirstStopSuggestsReservation(placeType: string, servingType?: string): boolean {
  if (placeType !== "FOOD") return false;
  const s = (servingType ?? "meal").toLowerCase();
  return s === "meal" || s === "light";
}
