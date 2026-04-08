"use client";

import React from "react";
import { colors, radius, space } from "@/lib/designTokens";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onMicClick?: () => void;
};

export function SearchInput({ value, onChange, onSubmit, onMicClick }: Props) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 52,
        padding: "0 6px 0 16px",
        borderRadius: radius.card,
        background: colors.bgCard,
        boxShadow: "0 10px 32px rgba(15,23,42,0.08)",
        border: `1px solid ${colors.borderSubtle}`,
        marginBottom: space.section,
      }}
    >
      <span style={{ fontSize: 18, opacity: 0.7 }} aria-hidden>
        🔎
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="오늘 뭐 할지 말해줘"
        aria-label="상황 입력"
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          fontSize: 15,
          fontWeight: 600,
          color: colors.textPrimary,
          background: "transparent",
          minWidth: 0,
        }}
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onMicClick?.();
        }}
        aria-label="음성 입력"
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.button,
          border: "none",
          cursor: "pointer",
          background: colors.bgMuted,
          fontSize: 20,
        }}
      >
        🎤
      </button>
      <button
        type="submit"
        style={{
          height: 40,
          padding: "0 18px",
          borderRadius: radius.button,
          border: "none",
          cursor: "pointer",
          background: colors.accentPrimary,
          color: "#fff",
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        보러 가기
      </button>
    </form>
  );
}
