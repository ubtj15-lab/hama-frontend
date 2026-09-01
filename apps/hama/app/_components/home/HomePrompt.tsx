"use client";

import React, { useMemo } from "react";
import { HOME_PURPLE } from "./homeBetaTheme";

type Props = {
  onAsk: () => void;
  onVoice: () => void;
};

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] as const;

export function homeContextLine(now = new Date()): string {
  const hour = now.getHours();
  const part = hour < 12 ? "오전" : hour < 18 ? "오후" : "저녁";
  return `${WEEKDAYS[now.getDay()]} ${part} · 오산`;
}

export function HomePrompt({ onAsk, onVoice }: Props) {
  const contextLine = useMemo(() => homeContextLine(), []);

  return (
    <section
      aria-labelledby="home-primary-question"
      style={{
        padding: "4px 0 8px",
      }}
    >
      <p
        style={{
          margin: "0 0 10px",
          fontSize: 13,
          fontWeight: 700,
          color: "#9A958C",
          letterSpacing: "-0.02em",
        }}
      >
        {contextLine}
      </p>
      <h1
        id="home-primary-question"
        style={{
          margin: 0,
          fontSize: "clamp(30px, 8.4vw, 36px)",
          fontWeight: 800,
          letterSpacing: "-0.045em",
          lineHeight: 1.22,
          color: "#1A1A1A",
        }}
      >
        오늘 뭐 하고
        <br />
        싶어요?
      </h1>
      <p
        style={{
          margin: "10px 0 0",
          fontSize: 14,
          fontWeight: 500,
          color: "#8A857C",
          lineHeight: 1.45,
        }}
      >
        하고 싶은 걸 말하면 하마가 골라드려요.
      </p>
      <button
        type="button"
        onClick={onVoice}
        aria-label="하고 싶은 걸 말해보세요"
        style={{
          width: "100%",
          marginTop: 16,
          minHeight: 56,
          border: "none",
          borderRadius: 18,
          background: HOME_PURPLE,
          color: "#fff",
          cursor: "pointer",
          boxShadow: "0 8px 18px rgba(107, 77, 230, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: "-0.03em",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 14.5a3.2 3.2 0 0 0 3.2-3.2V7.2a3.2 3.2 0 1 0-6.4 0v4.1A3.2 3.2 0 0 0 12 14.5Z"
            fill="#fff"
          />
          <path
            d="M6.8 11.2a.9.9 0 0 0-1.8 0 7 7 0 0 0 6.1 6.94V20H8.6a.9.9 0 0 0 0 1.8h6.8a.9.9 0 0 0 0-1.8h-2.5v-1.86A7 7 0 0 0 19 11.2a.9.9 0 0 0-1.8 0 5.2 5.2 0 1 1-10.4 0Z"
            fill="#fff"
          />
        </svg>
        하고 싶은 걸 말해보세요
      </button>
      <button
        type="button"
        onClick={onAsk}
        style={{
          display: "block",
          width: "100%",
          marginTop: 8,
          border: "none",
          background: "transparent",
          padding: "6px 0 2px",
          color: "#8A857C",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          cursor: "pointer",
        }}
      >
        직접 입력
      </button>
    </section>
  );
}
