"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, radius, space } from "@/lib/designTokens";
import {
  HAMA_ACTIVE_MISSION_KEY,
  loadActiveMission,
  parseActiveMission,
  RECEIPT_VERIFY_PATH,
  type HamaActiveMission,
} from "@/lib/mission/hamaActiveMission";

/**
 * TODO: 전용 영수증 업로드 UI 연결 — 현재는 진행 중 미션의 매장 상세(베타 인증)로 안내.
 * `/api/beta/receipt-verify` 플로우와 통합 시 이 페이지에서 FormData 제출 처리.
 */
export default function ReceiptPage() {
  const router = useRouter();
  const [mission, setMission] = useState<HamaActiveMission | null>(null);

  useEffect(() => {
    setMission(loadActiveMission());
    const onStorage = (e: StorageEvent) => {
      if (e.key === HAMA_ACTIVE_MISSION_KEY) {
        setMission(parseActiveMission(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const placeId = mission?.placeId != null ? String(mission.placeId) : "";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: colors.bgDefault,
        padding: `${space.pageX}px`,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          background: "#fff",
          borderRadius: radius.largeCard,
          border: `1px solid ${colors.borderSubtle}`,
          padding: 20,
          boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800, color: colors.textPrimary }}>
          영수증 인증
        </h1>
        {mission && !mission.verified ? (
          <>
            <p style={{ margin: "0 0 16px", color: colors.textSecondary, lineHeight: 1.55, fontSize: 14 }}>
              <strong>{mission.placeName}</strong> 방문 인증을 진행해 주세요.
              <br />
              영수증 사진을 제출하면 이벤트에 응모할 수 있어요.
            </p>
            {placeId ? (
              <button
                type="button"
                onClick={() => router.push(`/place/${encodeURIComponent(placeId)}`)}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 14px",
                  background: colors.accentPrimary,
                  color: colors.accentOnPrimary,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                매장 상세에서 인증하기
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/results?q=" + encodeURIComponent("아이랑 갈만한 곳"))}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 14px",
                  background: colors.accentPrimary,
                  color: colors.accentOnPrimary,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                추천 결과에서 인증하기
              </button>
            )}
          </>
        ) : (
          <p style={{ margin: "0 0 16px", color: colors.textSecondary, lineHeight: 1.55, fontSize: 14 }}>
            진행 중인 방문 미션이 없어요. 홈에서 추천을 받고 길찾기를 누르면 미션이 시작돼요.
          </p>
        )}
        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            width: "100%",
            marginTop: 10,
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: 12,
            padding: "10px 14px",
            background: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          홈으로
        </button>
      </div>
    </main>
  );
}
