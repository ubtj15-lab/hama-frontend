"use client";

import React, { useEffect, useState } from "react";
import { colors, radius, shadow, space } from "@/lib/designTokens";

const PLACEHOLDERS = [
  "아이랑 갈 곳 추천해줘",
  "오늘 데이트 어디가 좋을까?",
  "혼자 밥 먹기 괜찮은 데 있을까?",
  "부모님이랑 조용한 식사 자리",
];

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onMicClick?: () => void;
};

export function SearchInput({ value, onChange, onSubmit, onMicClick }: Props) {
  const [ph, setPh] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPh((i) => (i + 1) % PLACEHOLDERS.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <form
      onSubmit={onSubmit}
      aria-label="상황 입력"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 52,
        padding: "8px 8px 8px 18px",
        borderRadius: radius.searchBar,
        background: colors.bgSurface,
        boxShadow: shadow.card,
        border: `1px solid ${colors.borderSubtle}`,
        marginBottom: space.section,
      }}
    >
      <span style={{ fontSize: 18, opacity: 0.45, lineHeight: 1, flexShrink: 0 }} aria-hidden>
        🔍
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={PLACEHOLDERS[ph]}
        aria-label="오늘 상황을 한 줄로 입력"
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          fontSize: 15,
          fontWeight: 500,
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
        aria-label="음성으로 말하기"
        style={{
          width: 42,
          height: 42,
          borderRadius: radius.button,
          border: `1px solid ${colors.borderSubtle}`,
          cursor: "pointer",
          background: colors.bgMuted,
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        🎤
      </button>
      <button
        type="submit"
        style={{
          height: 42,
          padding: "0 18px",
          borderRadius: radius.button,
          border: "none",
          cursor: "pointer",
          background: colors.accentPrimary,
          color: colors.accentOnPrimary,
          fontWeight: 800,
          fontSize: 14,
          boxShadow: shadow.cta,
          flexShrink: 0,
        }}
      >
        추천 받기
      </button>
    </form>
  );
}
