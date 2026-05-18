"use client";

import React from "react";
import { colors, radius, space } from "@/lib/designTokens";

type Props = {
  visible: boolean;
  canNativeInstall: boolean;
  showManualGuide: boolean;
  onInstallClick: () => void;
  onDismiss: () => void;
};

/**
 * 오픈베타 PWA 설치 안내 — 작은 하단 배너 (자동 prompt 없음, 버튼 클릭 시에만 native prompt).
 */
export function PwaInstallBanner({
  visible,
  canNativeInstall,
  showManualGuide,
  onInstallClick,
  onDismiss,
}: Props) {
  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="앱 설치 안내"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 390,
        padding: `8px ${space.pageX}px max(10px, env(safe-area-inset-bottom, 0px))`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          maxWidth: 520,
          margin: "0 auto",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          borderRadius: radius.largeCard,
          background: colors.bgSurface,
          border: `1px solid ${colors.borderSubtle}`,
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.14)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 800,
              color: colors.textPrimary,
              lineHeight: 1.35,
            }}
          >
            하마를 앱처럼 바로 열 수 있어요
          </p>
          {showManualGuide ? (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                fontWeight: 600,
                color: colors.textSecondary,
                lineHeight: 1.45,
              }}
            >
              브라우저 메뉴에서 &lsquo;홈 화면에 추가&rsquo;를 눌러주세요.
            </p>
          ) : null}
          {canNativeInstall ? (
            <button
              type="button"
              onClick={onInstallClick}
              className="hama-press"
              style={{
                marginTop: 10,
                width: "100%",
                border: "none",
                borderRadius: radius.button,
                padding: "10px 12px",
                background: colors.accentPrimary,
                color: colors.accentOnPrimary,
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              홈 화면에 추가
            </button>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="닫기"
          onClick={onDismiss}
          style={{
            flexShrink: 0,
            border: "none",
            background: "transparent",
            color: colors.textMuted,
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}