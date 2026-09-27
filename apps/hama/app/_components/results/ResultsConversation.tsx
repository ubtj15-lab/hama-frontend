"use client";

import React from "react";
import { colors, radius } from "@/lib/designTokens";
import type { ConversationTurn } from "@/lib/conversation/types";

type Props = {
  turns: ConversationTurn[];
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  hideComposer?: boolean;
};

export function ResultsConversation({ turns, value, onChange, onSubmit, disabled = false, hideComposer = false }: Props) {
  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
  };

  return (
    <section aria-label="하마와 대화" style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 280,
          overflowY: "auto",
          marginBottom: 10,
        }}
      >
        {turns.map((turn, index) => {
          const mine = turn.role === "user";
          return (
            <div
              key={`${turn.timestamp}-${index}`}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "88%",
                padding: "8px 12px",
                borderRadius: radius.button,
                background: mine ? colors.accentPrimary : colors.primaryLight,
                color: mine ? "#fff" : colors.textPrimary,
                fontSize: 14,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
              }}
            >
              {turn.text}
            </div>
          );
        })}
      </div>
      {hideComposer ? null : (
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="이어서 말해 주세요"
          aria-label="이어서 말하기"
          style={{
            flex: 1,
            height: 44,
            borderRadius: 12,
            border: `1px solid ${colors.borderSubtle}`,
            padding: "0 12px",
            fontSize: 14,
            outline: "none",
            background: "#fff",
          }}
        />
        <button
          type="button"
          disabled={disabled || !value.trim()}
          onClick={submit}
          style={{
            height: 44,
            borderRadius: 12,
            border: "none",
            padding: "0 14px",
            background: colors.accentPrimary,
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            cursor: disabled ? "default" : "pointer",
          }}
        >
          보내기
        </button>
      </div>
      )}
    </section>
  );
}
