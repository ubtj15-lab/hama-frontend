// components/home/HomeMenuOverlay.tsx
"use client";

import React, { useMemo } from "react";

type HamaUser = {
  id?: string;
  nickname?: string | null;
  points?: number | null;
};

interface HomeMenuOverlayProps {
  open: boolean;
  menuPos: { top: number; left: number };
  user?: HamaUser | null;
  isLoggedIn: boolean;
  onClose: () => void;
  onKakaoClick: () => void;
  onPointHistory: () => void;
  onTodayRecommend: () => void;
  onBetaInfo: () => void;
  onMyReservations: () => void;
  onRecentStores: () => void;
  onSettings: () => void;
}

export default function HomeMenuOverlay({
  open,
  menuPos,
  user,
  isLoggedIn,
  onClose,
  onKakaoClick,
  onPointHistory,
  onTodayRecommend,
  onBetaInfo,
  onMyReservations,
  onRecentStores,
  onSettings,
}: HomeMenuOverlayProps) {
  const safeNickname = user?.nickname?.trim() ? user!.nickname : "게스트";
  const safePoints = useMemo(() => {
    const p = user?.points;
    return typeof p === "number" && Number.isFinite(p) ? p : 0;
  }, [user?.points]);

  if (!open) return null;

  // 화면 밖으로 나가지 않게 살짝 보정 (선택사항이지만 UX 안정)
  const left = Math.max(12, menuPos.left);
  const top = Math.max(12, menuPos.top);

  return (
    <>
      {/* 바깥 클릭 시 닫힘 */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1500,
        }}
      />

      {/* 메뉴 카드 */}
      <div
        style={{
          position: "fixed",
          top,
          left,
          width: 240,
          borderRadius: 20,
          background: "#ffffff",
          boxShadow:
            "0 10px 25px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(148, 163, 184, 0.3)",
          padding: 16,
          zIndex: 1600,
          fontSize: 13,
        }}
      >
        {/* 프로필/포인트 영역 */}
        <div
          style={{
            marginBottom: 16,
            paddingBottom: 10,
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#6B7280",
              marginBottom: 4,
            }}
          >
            안녕하세요
          </div>

          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#111827",
              marginBottom: 6,
            }}
          >
            {safeNickname} 님
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: "#EEF2FF",
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "#4F46E5",
                fontWeight: 600,
              }}
            >
              포인트
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {safePoints.toLocaleString()} P
            </span>
          </div>
        </div>

        {/* 카카오 로그인 / 메뉴 버튼들 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* 🔐 로그인 / 로그아웃 토글 버튼 */}
          <button
            onClick={onKakaoClick}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 999,
              border: "none",
              background: "#FEE500",
              fontSize: 14,
              fontWeight: 600,
              color: "#2D2D2D",
              cursor: "pointer",
            }}
          >
            {isLoggedIn ? "로그아웃" : "카카오로 로그인"}
          </button>

          <button
            onClick={onPointHistory}
            disabled={!isLoggedIn}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              background: "#ffffff",
              fontSize: 14,
              textAlign: "left",
              cursor: isLoggedIn ? "pointer" : "not-allowed",
              opacity: isLoggedIn ? 1 : 0.5,
            }}
          >
            📌 포인트 히스토리
          </button>

          <button
            onClick={onTodayRecommend}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "none",
              background: "#2563EB",
              fontSize: 14,
              fontWeight: 600,
              color: "#ffffff",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            오늘의 추천 보기
          </button>

          <button
            onClick={onBetaInfo}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              background: "#EEF2FF",
              fontSize: 14,
              fontWeight: 600,
              color: "#111827",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            🦛 베타 안내 보기
          </button>

          <button
            onClick={onMyReservations}
            disabled
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              background: "#f3f4f6",
              fontSize: 14,
              textAlign: "left",
              cursor: "not-allowed",
              opacity: 0.7,
            }}
          >
            내 예약 (준비중)
          </button>

          <button
            onClick={onRecentStores}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              background: "#ffffff",
              fontSize: 14,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            최근 본 매장
          </button>

          <button
            onClick={onSettings}
            disabled
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              background: "#f3f4f6",
              fontSize: 14,
              textAlign: "left",
              cursor: "not-allowed",
              opacity: 0.7,
            }}
          >
            설정 (준비중)
          </button>
        </div>
      </div>
    </>
  );
}
