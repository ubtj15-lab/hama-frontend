"use client";

import React, { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

type Props = {
  // ✅ 홈에서 쓰는 방식
  isListening?: boolean;
  onClick?: () => void;

  // ✅ 지도(map)에서 쓰는 기존 방식 (호환)
  onResult?: (text: string) => void;

  size?: number;
  style?: React.CSSProperties;
};

export default function MicButton({
  isListening: controlledListening,
  onClick,
  onResult,
  size = 92,
  style,
}: Props) {
  const [internalListening, setInternalListening] = useState(false);
  const recognitionRef = useRef<any | null>(null);

  const isControlled = typeof onClick === "function";
  const isListening = typeof controlledListening === "boolean" ? controlledListening : internalListening;

  // ✅ onResult가 들어오면(지도 페이지) 여기서 음성인식까지 처리해줌
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.lang = "ko-KR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setInternalListening(true);
    rec.onend = () => setInternalListening(false);
    rec.onerror = () => setInternalListening(false);

    rec.onresult = (event: any) => {
      const text = event?.results?.[0]?.[0]?.transcript?.trim?.() ?? "";
      if (text && onResult) onResult(text);
    };

    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, [onResult]);

  const handlePress = () => {
    // ✅ 홈(page.tsx) 방식: 외부에서 클릭 핸들링
    if (isControlled && onClick) {
      onClick();
      return;
    }

    // ✅ 지도(map) 방식: 컴포넌트 내부에서 음성인식 처리
    if (!onResult) return;

    const rec = recognitionRef.current;
    if (!rec) {
      alert("이 브라우저는 음성 인식을 지원하지 않아요 (크롬 권장)");
      return;
    }

    try {
      if (internalListening) rec.stop();
      else rec.start();
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={handlePress}
      aria-label="음성 검색"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "6px solid rgba(255,255,255,0.6)",
        background: isListening
          ? "linear-gradient(135deg, #1d4ed8, #1e40af)"
          : "linear-gradient(135deg, #38bdf8, #2563eb)",
        boxShadow:
          "0 18px 40px rgba(37, 99, 235, 0.45), 0 0 0 4px rgba(191, 219, 254, 0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 0.18s ease, transform 0.1s ease, box-shadow 0.18s ease",
        transform: isListening ? "scale(1.06)" : "scale(1)",
        ...style,
      }}
    >
      <span style={{ fontSize: Math.max(28, Math.floor(size * 0.35)), color: "#ffffff" }}>🎙</span>
    </button>
  );
}
