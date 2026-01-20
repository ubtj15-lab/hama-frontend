"use client";

import React, { useEffect, useRef } from "react";

type Props = {
  isLoggedIn: boolean;
  nickname: string;
  points: number;
  onLoginClick: () => void;
  onGoPoints: () => void;
  onGoBeta: () => void;
};

export default function HomeTopBar({
  isLoggedIn,
  nickname,
  points,
  onLoginClick,
  onGoPoints,
  onGoBeta,
}: Props) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState({ top: 60, left: 10 });
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const updateMenuPosition = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, left: rect.left });
  };

  useEffect(() => {
    if (menuOpen) updateMenuPosition();
  }, [menuOpen]);

  useEffect(() => {
    const handler = () => menuOpen && updateMenuPosition();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [menuOpen]);

  return (
    <>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <button
          ref={btnRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="메뉴 열기"
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            border: "none",
            background: "#ffffff",
            boxShadow: "0 6px 18px rgba(15,23,42,0.12)",
            cursor: "pointer",
            fontSize: 18,
          }}
        >
          ☰
        </button>

        <div style={{ fontWeight: 900, letterSpacing: 1.2, fontSize: 22, color: "#2563EB" }}>HAMA</div>

        <button
          type="button"
          onClick={onLoginClick}
          style={{
            height: 42,
            borderRadius: 999,
            border: "none",
            padding: "0 14px",
            background: isLoggedIn ? "#111827" : "#FEE500",
            color: isLoggedIn ? "#ffffff" : "#111827",
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 6px 18px rgba(15,23,42,0.12)",
          }}
        >
          {isLoggedIn ? "로그아웃" : "카카오 로그인"}
        </button>
      </header>

      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "transparent",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: menuPos.top,
              left: menuPos.left,
              width: 180,
              borderRadius: 16,
              background: "#ffffff",
              boxShadow: "0 16px 40px rgba(15,23,42,0.18)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 12, color: "#6B7280" }}>닉네임</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{nickname}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#2563EB", fontWeight: 800 }}>
                {points.toLocaleString()}P
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onGoPoints();
              }}
              style={{
                width: "100%",
                padding: "12px 12px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "#111827",
              }}
            >
              포인트 내역
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onGoBeta();
              }}
              style={{
                width: "100%",
                padding: "12px 12px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "#111827",
              }}
            >
              베타 안내
            </button>
          </div>
        </div>
      )}
    </>
  );
}
