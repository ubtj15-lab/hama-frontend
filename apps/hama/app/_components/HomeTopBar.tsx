"use client";

import React, { useEffect, useRef } from "react";
import { PARTNER_APP_URL } from "../lib/partnerUrl";
import { colors, radius, shadow, typo } from "@/lib/designTokens";

type Props = {
  isLoggedIn: boolean;
  nickname: string;
  points: number;
  onLoginClick: () => void;
  onGoPoints: () => void;
  onGoMy?: () => void;
  onGoBeta: () => void;
};

const btnBase = {
  height: 42,
  borderRadius: radius.pill,
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer" as const,
  border: "none" as const,
  boxShadow: shadow.headerBtn,
  display: "inline-flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  padding: "0 14px",
};

export default function HomeTopBar({
  isLoggedIn,
  nickname,
  points,
  onLoginClick,
  onGoPoints,
  onGoMy,
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
          marginBottom: 14,
          gap: 8,
        }}
      >
        <button
          ref={btnRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="메뉴 열기"
          style={{
            ...btnBase,
            width: 42,
            padding: 0,
            background: colors.bgSurface,
            color: colors.textPrimary,
            fontSize: 18,
          }}
        >
          ☰
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div
            style={{
              fontWeight: 900,
              letterSpacing: "0.12em",
              fontSize: 20,
              color: colors.accentPrimary,
            }}
          >
            HAMA
          </div>
          <a
            href={PARTNER_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...typo.caption,
              fontWeight: 800,
              color: colors.accentStrong,
              textDecoration: "none",
              padding: "8px 12px",
              borderRadius: radius.pill,
              background: colors.accentSoft,
              border: `1px solid ${colors.borderSubtle}`,
              whiteSpace: "nowrap",
            }}
          >
            매장주
          </a>
        </div>

        <button
          type="button"
          onClick={onLoginClick}
          style={{
            ...btnBase,
            background: isLoggedIn ? colors.textPrimary : "#FEE500",
            color: isLoggedIn ? colors.accentOnPrimary : colors.textPrimary,
            minWidth: 96,
          }}
        >
          {isLoggedIn ? "로그아웃" : "로그인"}
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
              width: 220,
              maxHeight: "min(70vh, 400px)",
              borderRadius: radius.card,
              background: colors.bgSurface,
              boxShadow: shadow.elevated,
              overflowY: "auto",
              overflowX: "hidden",
              border: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ fontSize: 12, color: colors.textSecondary }}>닉네임</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: colors.textPrimary }}>{nickname}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: colors.accentStrong, fontWeight: 800 }}>
                {points.toLocaleString()}P
              </div>
            </div>

            <a
              href={PARTNER_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 14px",
                textAlign: "left",
                background: colors.accentSoft,
                border: "none",
                borderBottom: `1px solid ${colors.borderSubtle}`,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                color: colors.accentStrong,
                textDecoration: "none",
              }}
            >
              매장주 대시보드
            </a>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onGoPoints();
              }}
              style={{
                width: "100%",
                padding: "12px 14px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: colors.textPrimary,
              }}
            >
              포인트 내역
            </button>

            {onGoMy && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onGoMy();
                }}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  color: colors.textPrimary,
                }}
              >
                저장·최근본
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onGoBeta();
              }}
              style={{
                width: "100%",
                padding: "12px 14px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: colors.textPrimary,
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
