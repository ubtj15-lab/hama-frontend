"use client";

import React from "react";
import { colors, radius, shadow } from "@/lib/designTokens";

type Props = {
  isLoggedIn?: boolean;
  nickname?: string;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
  onGoMy?: () => void;
  onAlertClick?: () => void;
};

export default function HomeTopBar({
  isLoggedIn = false,
  nickname = "MY",
  onLoginClick,
  onLogoutClick,
  onGoMy,
  onAlertClick,
}: Props) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
        position: "relative",
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <strong style={{ fontSize: 24, letterSpacing: "-0.03em", color: colors.textPrimary }}>HAMA</strong>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: colors.textSecondary,
            background: "#fff",
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: radius.pill,
            padding: "5px 10px",
          }}
        >
          오산·동탄
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative", zIndex: 60 }}>
        <button
          type="button"
          aria-label="알림"
          onClick={onAlertClick}
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            border: `1px solid ${colors.borderSubtle}`,
            background: "#fff",
            boxShadow: shadow.headerBtn,
            cursor: "pointer",
            fontSize: 17,
            color: colors.textPrimary,
          }}
        >
          🔔
        </button>

        {!isLoggedIn ? (
          <button
            type="button"
            onClick={() => {
              if (onLoginClick) onLoginClick();
              else window.location.href = "/api/auth/kakao/login?return_to=%2F";
            }}
            style={{
              height: 34,
              borderRadius: radius.pill,
              border: "none",
              background: "#FEE500",
              color: "#111827",
              fontSize: 12,
              fontWeight: 900,
              padding: "0 12px",
              boxShadow: shadow.headerBtn,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            카카오 로그인
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                height: 34,
                borderRadius: radius.pill,
                border: `1px solid ${colors.borderSubtle}`,
                background: "#fff",
                color: colors.textPrimary,
                fontSize: 12,
                fontWeight: 900,
                padding: "0 11px",
                boxShadow: shadow.headerBtn,
                cursor: "pointer",
                maxWidth: 120,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {nickname || "MY"}
            </button>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 40,
                  minWidth: 120,
                  background: "#fff",
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: 12,
                  boxShadow: shadow.headerBtn,
                  zIndex: 2000,
                  overflow: "hidden",
                  pointerEvents: "auto",
                }}
              >
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
