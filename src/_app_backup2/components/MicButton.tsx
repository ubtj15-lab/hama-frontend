"use client";

import { useEffect } from "react";

type Props = {
  onTranscribe: (text: string) => void;
  isListening: boolean;
  setIsListening: (v: boolean) => void;
};

export default function MicButton({ onTranscribe, isListening, setIsListening }: Props) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // 인식 객체 준비
    const SR =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;

    // 브라우저 미지원이어도 버튼은 보이게 유지 (동작만 안 함)
    if (!SR) {
      console.warn("[Mic] SpeechRecognition not supported");
      return;
    }

    const rec = new SR();
    rec.lang = "ko-KR";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript?.trim() || "";
      if (text) onTranscribe(text);
    };

    if (isListening) rec.start();

    return () => {
      try { rec.abort(); } catch {}
    };
  }, [isListening, onTranscribe, setIsListening]);

  return (
    <button
      onClick={() => setIsListening(!isListening)}
      title="음성 입력"
      style={{
        // 버튼 자체가 절대 안 묻히게 강한 스타일
        background: isListening ? "#111" : "#ff4d4f",
        color: "#fff",
        padding: "12px 16px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 16,
        border: "2px solid rgba(255,255,255,0.6)",
        boxShadow: "0 10px 20px rgba(0,0,0,0.25)",
        cursor: "pointer",
      }}
    >
      🎤 {isListening ? "듣는 중…" : "마이크"}
    </button>
  );
}
