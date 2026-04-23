"use client";

import React from "react";
import { colors, space, radius, shadow } from "@/lib/designTokens";

type Props = {
  open: boolean;
  isIos: boolean;
  onDismiss: () => void;
  onSnooze: () => void;
  onInstallClick: () => void;
  canNativeInstall: boolean;
};

export function PwaInstallSheet({
  open,
  isIos,
  onDismiss,
  onSnooze,
  onInstallClick,
  canNativeInstall,
}: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="hama-pwa-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        aria-label="닫기"
        onClick={onSnooze}
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          background: "rgba(15, 23, 42, 0.35)",
          cursor: "pointer",
        }}
      />
      <div
        className="hama-press"
        style={{
          position: "relative",
          margin: space.pageX,
          marginBottom: `max(${space.pageX}px, env(safe-area-inset-bottom, 0px))`,
          padding: space.cardPadding * 1.1,
          borderRadius: radius.largeCard,
          background: colors.bgSurface,
          boxShadow: shadow.elevated,
          border: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <p
          id="hama-pwa-title"
          style={{
            margin: 0,
            fontSize: "1.05rem",
            fontWeight: 700,
            color: colors.textPrimary,
            lineHeight: 1.35,
          }}
        >
          더 빨리 열고 싶다면
        </p>
        <p
          style={{
            margin: `${space.chip * 1.5}px 0 ${space.cardPadding}px`,
            fontSize: "0.9rem",
            color: colors.textSecondary,
            lineHeight: 1.45,
          }}
        >
          {isIos
            ? "하마를 홈 화면에 추가하면 앱처럼 바로 실행할 수 있어요. 아래 단계를 따라 주세요."
            : "하마를 홈 화면에 추가하면 더 빨리 열 수 있어요. 자주 쓰면 홈에 두는 걸 추천해요."}
        </p>
        {isIos ? (
          <ol
            style={{
              margin: `0 0 ${space.cardPadding}px`,
              paddingLeft: "1.1rem",
              fontSize: "0.88rem",
              color: colors.textPrimary,
              lineHeight: 1.5,
            }}
          >
            <li>
              <strong>공유</strong> 버튼(사각형·화살표 아이콘)을 누르고
            </li>
            <li>
              <strong>홈 화면에 추가</strong>을 선택하세요
            </li>
          </ol>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: space.chip }}>
          {canNativeInstall && !isIos ? (
            <button
              type="button"
              onClick={onInstallClick}
              className="hama-press"
              style={primaryButtonStyle}
            >
              홈 화면에 추가하기
            </button>
          ) : isIos ? (
            <p style={{ margin: 0, fontSize: "0.82rem", color: colors.textMuted }}>
              iPhone은 Safari의 공유 메뉴에서 홈 화면에 추가할 수 있어요.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: "0.82rem", color: colors.textMuted }}>
              Chrome에서 주소창 오른쪽 메뉴(⋮) → <strong>홈 화면에 설치</strong> 또는 <strong>앱 설치</strong>를 선택할 수 있어요.
            </p>
          )}
          <div style={{ display: "flex", gap: space.chip }}>
            <button type="button" onClick={onSnooze} style={secondaryButtonStyle}>
              나중에
            </button>
            <button type="button" onClick={onDismiss} style={ghostButtonStyle}>
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: radius.button,
  padding: `${space.chip * 1.5}px ${space.cardPadding}px`,
  background: `linear-gradient(180deg, ${colors.accentPrimary} 0%, ${colors.accentStrong} 100%)`,
  color: colors.accentOnPrimary,
  fontSize: "0.92rem",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: radius.button,
  padding: `${space.chip}px ${space.chip * 1.5}px`,
  background: colors.bgSurface,
  color: colors.textPrimary,
  fontSize: "0.88rem",
  fontWeight: 500,
  cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  flex: 1,
  background: "transparent",
  color: colors.textSecondary,
};
