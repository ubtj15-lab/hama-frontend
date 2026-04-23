/**
 * "추천 시작 시간" — 현재 시각·시나리오·체류 길이 기반 휴리스틱.
 * 예약 시스템의 availability 가 아님. UI에서는 반드시 "추천" 문구와 함께 사용.
 * @see UI_COPY — 연동 전 금지: "예약 가능", "바로 예약"
 */
import type { TimeOfDay } from "./courseTypes";
import { resolveTimeOfDayBucket } from "./recommendTimeOfDay";

export type RecommendedStartTimeKind = "now" | "range" | "tonight" | "afternoon" | "lunch" | "flex";

export type RecommendedStartTimeResult = {
  /** "18:30", "지금 바로", "19:00 전후" 등 */
  recommendedStartTimeLabel: string;
  /** ISO 8601 또는 "now" / null(표시만 라벨) */
  recommendedStartTimeValue: string | "now" | null;
  /** UI 서브/툴팁용 한 줄 */
  reason: string;
  kind: RecommendedStartTimeKind;
};

type Input = {
  now: Date;
  /** `scenarioEngine` 시나리오와 호환 — family 는 family_kids 규칙에 근접하게 매핑 */
  scenario: string;
  timeOfDay: TimeOfDay;
  courseDurationMin: number;
  mealRequired?: boolean;
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatHm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60 * 1000);
}

/**
 * date + evening → 18:00~19:30대 가중
 * family + daytime → 점심/오후 전후
 * solo + daytime → 지금~점심대
 * night → 늦은 식사보다 가벼운 동선(카페/산책) 암시는 reason 에만
 */
export function computeRecommendedStartTime(input: Input): RecommendedStartTimeResult {
  const { now, scenario, timeOfDay, courseDurationMin, mealRequired } = input;
  const bucket = resolveTimeOfDayBucket(now, timeOfDay);
  const h = now.getHours();
  const m = now.getMinutes();

  if (bucket === "night" || timeOfDay === "night") {
    return {
      recommendedStartTimeLabel: "지금 바로",
      recommendedStartTimeValue: "now",
      reason: "늦은 시간대엔 짧은 동선·가벼운 코스가 이어지기 쉬워요.",
      kind: "now",
    };
  }

  if (scenario === "date" && (bucket === "evening" || timeOfDay === "dinner")) {
    const target = new Date(now);
    target.setHours(18, 30, 0, 0);
    if (now > target) {
      const flex = addMinutes(now, 25);
      return {
        recommendedStartTimeLabel: `${formatHm(flex)} 전후`,
        recommendedStartTimeValue: flex.toISOString(),
        reason: "저녁 데이트는 해 지기 전후로 이어가기 좋아요.",
        kind: "tonight",
      };
    }
    return {
      recommendedStartTimeLabel: "18:00 ~ 19:30",
      recommendedStartTimeValue: target.toISOString(),
      reason: "데이트 저녁은 이 시간대가 자연스러워요.",
      kind: "range",
    };
  }

  const isFamily = scenario === "family_kids" || scenario === "family" || scenario === "parent_child_outing";
  if (isFamily && (bucket === "day" || ["morning", "lunch", "afternoon"].includes(timeOfDay))) {
    if (h < 14) {
      return {
        recommendedStartTimeLabel: "11:30 ~ 13:00",
        recommendedStartTimeValue: null,
        reason: "가족 외식은 점심 전후가 부담이 적어요.",
        kind: "lunch",
      };
    }
    return {
      recommendedStartTimeLabel: "16:00 전후",
      recommendedStartTimeValue: null,
      reason: "오후에는 짧은 이동이 있는 코스를 맞추기 좋아요.",
      kind: "afternoon",
    };
  }

  if (scenario === "solo" && (bucket === "day" || ["morning", "lunch", "afternoon"].includes(timeOfDay))) {
    if (mealRequired) {
      const slot = h >= 10 && h < 14 ? addMinutes(now, 20) : new Date(now);
      if (h >= 10 && h < 14) {
        return {
          recommendedStartTimeLabel: `${formatHm(slot)}쯤`,
          recommendedStartTimeValue: slot.toISOString(),
          reason: "혼밥·간단 식사는 점심대가 무난해요.",
          kind: "lunch",
        };
      }
    }
    return {
      recommendedStartTimeLabel: "지금 바로",
      recommendedStartTimeValue: "now",
      reason: "가벼운 코스는 지금 이어가기 좋아요.",
      kind: "now",
    };
  }

  const prep = addMinutes(now, 15);
  return {
    recommendedStartTimeLabel: courseDurationMin > 200 ? `${formatHm(prep)} 전후` : "지금 바로",
    recommendedStartTimeValue: courseDurationMin > 200 ? prep.toISOString() : "now",
    reason: "짧은 코스는 바로, 긴 코스는 준비 시간을 잡는 편이 좋아요.",
    kind: courseDurationMin > 200 ? "flex" : "now",
  };
}

/**
 * 실제 예약 API 연동 시에만 사용. 지금은 항상 null.
 */
export type ReservationSlot = { start: string; end?: string; label: string; source: "naver" | "internal" };

export function getReservationAvailableTimes(
  _placeId: string,
  _options?: { from?: Date }
): ReservationSlot[] | null {
  return null;
}
