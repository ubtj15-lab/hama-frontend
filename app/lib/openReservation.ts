// app/lib/openReservation.ts
"use client";

import type { HomeCard } from "@/lib/storeTypes";
import { openPlace } from "@/lib/openPlace";

function normalize(v?: string | null) {
  return String(v ?? "").trim();
}

/**
 * ✅ 예약하기 버튼 동작
 * 1) card.reservation_url 있으면 -> 그 링크로 이동 (네이버예약/캐치테이블/카카오예약 등)
 * 2) 없으면 -> 네이버 플레이스(또는 검색)로 보내서 거기서 예약하도록 유도
 */
export function openReservation(card: Partial<HomeCard>) {
  if (typeof window === "undefined") return;

  const anyCard = card as any;
  const reservationUrl =
    normalize(anyCard?.reservation_url) ||
    normalize(anyCard?.reservationUrl) ||
    normalize(anyCard?.reservation_url);

  if (reservationUrl) {
    window.open(reservationUrl, "_blank", "noopener,noreferrer");
    return;
  }

  // ✅ fallback: 네이버 플레이스로 보내기
  openPlace(card, "naver");
}
