"use client";

import React from "react";
import { logEvent } from "@/lib/logEvent";

export default function SideMenu({
  user,
  isLoggedIn,
  menuOpen,
  menuPos,
  menuButtonRef, // 필요하면 header에서 ref로 연결
  toggleMenu,
  closeMenu,
  loginLocal,
  logoutLocal,
  onGo,
}: {
  user: { nickname: string; points: number };
  isLoggedIn: boolean;

  menuOpen: boolean;
  menuPos: { top: number; left: number };
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;

  toggleMenu: () => void;
  closeMenu: () => void;

  loginLocal: () => void;
  logoutLocal: () => void;

  onGo: (path: string) => void;
}) {
  return (
    <>
      {/* menuOpen 제어는 page.tsx에서 HomeHeader 버튼으로 toggleMenu 호출 */}
      {menuOpen && (
        <>
          <div onClick={closeMenu} style={{ position: "fixed", inset: 0, zIndex: 1500 }} />

          <div
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: 240,
              borderRadius: 20,
              background: "#ffffff",
              boxShadow: "0 10px 25px rgba(15,23,42,0.12), 0 0 0 1px rgba(148,163,184,0.3)",
              padding: 16,
              zIndex: 1600,
              fontSize: 13,
            }}
          >
            <div style={{ marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>안녕하세요</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
                {user.nickname || "게스트"} 님
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "#EEF2FF" }}>
                <span style={{ fontSize: 12, color: "#4F46E5", fontWeight: 600 }}>포인트</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  {user.points.toLocaleString()} P
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => {
                  if (isLoggedIn) {
                    logEvent("logout", { page: "home" });
                    logoutLocal();
                    // 실제 카카오 로그아웃 붙이면 여기서 redirect
                    // window.location.href = "/api/auth/kakao/logout";
                  } else {
                    logEvent("login_start", { page: "home" });
                    loginLocal();
                    // 실제 카카오 로그인 붙이면 여기서 redirect
                    // window.location.href = "/api/auth/kakao/login";
                  }
                  closeMenu();
                }}
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
                onClick={() => {
                  closeMenu();
                  logEvent("page_view", { page: "point_history" });
                  onGo("/mypage/points");
                }}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #E5E7EB", background: "#fff", fontSize: 14, textAlign: "left", cursor: "pointer" }}
              >
                포인트 히스토리
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  logEvent("page_view", { page: "recommend" });
                  onGo("/recommend");
                }}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "none", background: "#2563EB", fontSize: 14, fontWeight: 600, color: "#fff", textAlign: "left", cursor: "pointer" }}
              >
                오늘의 추천 보기
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
