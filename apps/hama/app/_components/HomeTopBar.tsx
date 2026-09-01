"use client";

import React from "react";
import { colors, radius, shadow } from "@/lib/designTokens";
import { HOME_PURPLE } from "./home/homeBetaTheme";

type Props = {
  isLoggedIn?: boolean;
  nickname?: string;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
  onGoMy?: () => void;
  onAlertClick?: () => void;
  onSearchClick?: () => void;
};

export default function HomeTopBar({
  isLoggedIn = false,
  nickname = "MY",
  onLoginClick,
  onLogoutClick,
  onGoMy,
  onAlertClick,
  onSearchClick,
}: Props) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        minHeight: 44,
        marginBottom: 8,
        position: "relative",
        zIndex: 50,
      }}
    >
      <strong style={{ fontSize: 20, letterSpacing: "-0.04em", color: HOME_PURPLE, justifySelf: "start" }}>HAMA</strong>
      <button
        type="button"
        aria-label="현재 지역 오산시"
        onClick={onSearchClick}
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: "#2A2A2A",
          background: "transparent",
          border: "none",
          padding: "6px 8px",
          minHeight: 36,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span aria-hidden style={{ color: HOME_PURPLE, fontSize: 12 }}>📍</span>
        오산시
        <span aria-hidden style={{ fontSize: 9, color: "#B0AAA3" }}>▼</span>
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2, position: "relative", zIndex: 60 }}>
        <button
          type="button"
          aria-label="알림"
          onClick={onAlertClick}
          style={{
            position: "relative",
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "#3A3A3A",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 22a2.1 2.1 0 0 0 2.1-2.1h-4.2A2.1 2.1 0 0 0 12 22Zm7.2-6.3V11a7.2 7.2 0 1 0-14.4 0v4.7L3 17.6V19h18v-1.4l-1.8-1.9Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 9,
              right: 9,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: HOME_PURPLE,
              border: "1.5px solid #FFFDFB",
            }}
          />
        </button>

        {!isLoggedIn ? (
          <button
            type="button"
            onClick={() => {
              if (onLoginClick) onLoginClick();
              else window.location.href = "/api/auth/kakao/login?next=%2F";
            }}
            style={{
              height: 32,
              borderRadius: radius.pill,
              border: "none",
              background: "#FEE500",
              color: "#111827",
              fontSize: 11,
              fontWeight: 900,
              padding: "0 10px",
              boxShadow: shadow.headerBtn,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            로그인
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="프로필"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid #EDE6DC",
                background: "#F3EFE8",
                color: "#6B6862",
                fontSize: 14,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
              }}
              title={nickname}
            >
              👤
            </button>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 42,
                  minWidth: 128,
                  background: "#fff",
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: 12,
                  boxShadow: shadow.headerBtn,
                  zIndex: 2000,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "10px 12px 6px",
                    fontSize: 12,
                    fontWeight: 800,
                    color: colors.textSecondary,
                  }}
                >
                  {nickname || "MY"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (onGoMy) onGoMy();
                    else window.location.href = "/my";
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    background: "#fff",
                    padding: "10px 12px",
                    fontSize: 12,
                    fontWeight: 800,
                    textAlign: "left",
                    cursor: "pointer",
                    color: colors.textPrimary,
                  }}
                >
                  마이페이지
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (onLogoutClick) onLogoutClick();
                    else window.location.href = "/api/auth/kakao/logout";
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    borderTop: `1px solid ${colors.borderSubtle}`,
                    background: "#fff",
                    padding: "10px 12px",
                    fontSize: 12,
                    fontWeight: 800,
                    textAlign: "left",
                    cursor: "pointer",
                    color: colors.textSecondary,
                  }}
                >
                  로그아웃
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}
