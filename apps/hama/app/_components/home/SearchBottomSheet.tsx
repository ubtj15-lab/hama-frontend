"use client";

import React, { useEffect, useRef, useState } from "react";
import { colors, radius } from "@/lib/designTokens";
import { logEvent } from "@/lib/logEvent";
import { HamaEvents } from "@/lib/analytics/events";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmitQuery: (q: string) => void;
  startVoiceOnOpen?: boolean;
};

export function SearchBottomSheet({ open, onClose, onSubmitQuery, startVoiceOnOpen = false }: Props) {
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any | null>(null);

  useEffect(() => {
    if (!open) {
      setListening(false);
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = "ko-KR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (event: any) => {
      const text = event?.results?.[0]?.[0]?.transcript?.trim?.() ?? "";
      if (text) {
        setQuery(text);
        onSubmitQuery(text);
        onClose();
      }
    };
    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [onClose, onSubmitQuery]);

  useEffect(() => {
    if (!open || !startVoiceOnOpen) return;
    const t = window.setTimeout(() => {
      const rec = recognitionRef.current;
      if (!rec) {
        window.alert("이 브라우저는 음성 인식을 지원하지 않아요 (크롬 권장)");
        return;
      }
      try {
        rec.start();
      } catch {
        /* ignore */
      }
    }, 180);
    return () => window.clearTimeout(t);
  }, [open, startVoiceOnOpen]);

  if (!open) return null;

  const submit = () => {
    const t = query.trim();
    if (!t) return;
    onSubmitQuery(t);
    setQuery("");
    onClose();
  };

  const handleMic = () => {
    logEvent(HamaEvents.voice_mic_click, { page: "home", source: "search_sheet" });
    const rec = recognitionRef.current;
    if (!rec) {
      window.alert("이 브라우저는 음성 인식을 지원하지 않아요 (크롬 권장)");
      return;
    }
    try {
      if (listening) rec.stop();
      else rec.start();
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="검색"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <button
        type="button"
        aria-label="닫기 배경"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          background: "rgba(26, 26, 26, 0.42)",
          cursor: "pointer",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "#FFFDF8",
          borderRadius: "24px 24px 0 0",
          padding: "16px 16px calc(18px + env(safe-area-inset-bottom, 0px))",
          boxShadow: "0 -12px 40px rgba(15, 23, 42, 0.12)",
          maxWidth: 430,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 999,
            background: "#E8E0D4",
            margin: "0 auto 14px",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <strong style={{ fontSize: 17, color: colors.textPrimary, letterSpacing: "-0.02em" }}>
            하마에게 물어보기
          </strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              border: "none",
              background: colors.bgMuted,
              borderRadius: radius.pill,
              width: 36,
              height: 36,
              cursor: "pointer",
              fontWeight: 800,
              color: colors.textSecondary,
            }}
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fff",
            border: "1.5px solid #FFE0D0",
            borderRadius: 16,
            padding: "8px 8px 8px 14px",
            minHeight: 54,
          }}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="데이트, 가족 나들이, 혼자 시간..."
            aria-label="검색어 입력"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 15,
              fontWeight: 600,
              background: "transparent",
              color: colors.textPrimary,
              minWidth: 0,
            }}
          />
          <button
            type="button"
            onClick={handleMic}
            aria-label="음성 검색"
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              border: "none",
              background: listening ? "#FF6B35" : "#FFF1E8",
              color: listening ? "#fff" : "#FF6B35",
              cursor: "pointer",
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
              padding: "0 14px",
              borderRadius: 12,
              border: "none",
              background: "#FF6B35",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            검색
          </button>
        </form>
      </div>
    </div>
  );
}
