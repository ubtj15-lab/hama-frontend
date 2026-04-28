export type VisitVerificationTrack = "hama_pay" | "receipt";

/**
 * 방문 인증 트랙을 분리해서 향후 실결제 연결 시 교체 지점을 명확히 유지한다.
 * - hama_pay: 결제 기반 자동 인증
 * - receipt: 영수증 인증(기존 구조 유지)
 */
export function buildVisitVerificationContext(input: {
  track: VisitVerificationTrack;
  placeId: string;
  sourcePage?: string | null;
  meta?: Record<string, unknown> | null;
}): Record<string, unknown> {
  return {
    verification_track: input.track,
    place_id: input.placeId,
    source_page: input.sourcePage ?? null,
    ...(input.meta ?? {}),
  };
}
